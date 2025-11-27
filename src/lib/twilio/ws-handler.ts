/**
 * WebSocket message handler for Twilio Media Streams
 * Separated from server-ws.ts for lazy loading
 */

import { ServerWebSocket } from "bun";
import { OpenAIRealtimeClient } from "~/lib/realtime/openai-client";
import { pcmuToPCM16, pcm16ToPCMU } from "~/lib/realtime/audio-converter";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { env } from "~/env/server";
import { calls } from "~/lib/db/schema/calls";
import * as schema from "~/lib/db/schema";

interface TwilioStreamMessage {
  event: "connected" | "start" | "media" | "stop";
  streamSid?: string;
  start?: {
    callSid: string;
    customParameters?: Record<string, string>;
  };
  media?: {
    track: "inbound" | "outbound";
    chunk: string;
    timestamp: string;
    payload: string;
  };
  stop?: {
    callSid: string;
  };
}

interface WebSocketData {
  openaiClient?: OpenAIRealtimeClient;
  callSid?: string;
  streamSid?: string;
  audioChunkCount: number;
}

export async function handleTwilioMessage(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
  try {
    const data: TwilioStreamMessage = JSON.parse(message.toString());
    
    if (data.event !== "media") {
      console.log("[Twilio Stream] 📥 Event:", data.event);
    }
    
    switch (data.event) {
      case "connected":
        console.log("[Twilio Stream] ✅ Stream connected:", data.streamSid);
        break;
        
      case "start":
        console.log("[Twilio Stream] 🚀 Stream STARTED");
        await handleStreamStart(ws, data);
        break;
        
      case "media":
        await handleMediaChunk(ws, data);
        break;
        
      case "stop":
        console.log("[Twilio Stream] ⏹️  Stream STOPPED");
        await handleStreamStop(ws, data);
        break;
    }
  } catch (error) {
    console.error("[Twilio Stream] ❌ Error:", error);
  }
}

async function handleStreamStart(ws: ServerWebSocket<WebSocketData>, data: TwilioStreamMessage) {
  const startTime = Date.now();
  const callSid = data.start?.callSid;
  
  if (!callSid) {
    console.error("[Twilio Stream] ❌ No callSid");
    return;
  }
  
  console.log("[Twilio Stream] ⏱️  START - Call SID:", callSid);
  
  const driver = postgres(env.DATABASE_URL);
  const db = drizzle({ client: driver, schema, casing: "snake_case" });
  
  try {
    const [call] = await db
      .select()
      .from(calls)
      .where(eq(calls.callSid, callSid))
      .limit(1);
    
    if (!call) {
      console.error("[Twilio Stream] ❌ Call not found");
      await driver.end();
      return;
    }
    
    console.log("[Twilio Stream] ✅ Found call:", call.id);
    
    if (!call.openaiPrompt) {
      console.error(`[Twilio Stream] ❌ Call ${call.id} missing OpenAI prompt!`);
      throw new Error(`Missing OpenAI prompt for call ${call.id}`);
    }

    const openaiClient = new OpenAIRealtimeClient({
      apiKey: env.OPENAI_API_KEY!,
      voice: "alloy",
      instructions: call.openaiPrompt,
    });
    
    console.log("[Twilio Stream] 🔌 Connecting to OpenAI...");
    await openaiClient.connect();
    console.log(`[Twilio Stream] ⏱️  Setup took ${Date.now() - startTime}ms`);
    
    ws.data.openaiClient = openaiClient;
    ws.data.callSid = callSid;
    ws.data.streamSid = data.streamSid;
    
    openaiClient.onAudio((audioBase64) => {
      const pcmuAudio = pcm16ToPCMU(audioBase64);
      ws.send(JSON.stringify({
        event: "media",
        streamSid: ws.data.streamSid,
        media: { payload: pcmuAudio },
      }));
    });
    
    openaiClient.onTranscript((text) => {
      console.log("[OpenAI] 📝", text);
    });
    
  } catch (error) {
    console.error("[Twilio Stream] ❌ Setup error:", error);
  } finally {
    await driver.end();
  }
}

async function handleMediaChunk(ws: ServerWebSocket<WebSocketData>, data: TwilioStreamMessage) {
  if (!data.media || data.media.track !== "inbound") return;
  
  if (!ws.data.openaiClient) {
    ws.data.audioChunkCount++;
    if (ws.data.audioChunkCount % 50 === 1) {
      console.warn(`[Twilio Stream] ⚠️  OpenAI not ready - dropped ${ws.data.audioChunkCount} chunks`);
    }
    return;
  }
  
  const pcm16Audio = pcmuToPCM16(data.media.payload);
  ws.data.openaiClient.sendAudio(pcm16Audio);
}

async function handleStreamStop(ws: ServerWebSocket<WebSocketData>, data: TwilioStreamMessage) {
  if (ws.data.openaiClient) {
    ws.data.openaiClient.commitAudio();
    await new Promise(r => setTimeout(r, 1000));
    ws.data.openaiClient.close();
  }
  ws.close();
}

