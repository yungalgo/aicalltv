/**
 * WebSocket message handler for Twilio Media Streams (Node.js version)
 */

import { WebSocket } from "ws";
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

export async function handleTwilioMessage(ws: WebSocket, data: WebSocketData, message: string) {
  try {
    const parsed: TwilioStreamMessage = JSON.parse(message);
    
    if (parsed.event !== "media") {
      console.log("[Twilio Stream] 📥 Event:", parsed.event);
    }
    
    switch (parsed.event) {
      case "connected":
        console.log("[Twilio Stream] ✅ Stream connected:", parsed.streamSid);
        break;
        
      case "start":
        console.log("[Twilio Stream] 🚀 Stream STARTED");
        await handleStreamStart(ws, data, parsed);
        break;
        
      case "media":
        await handleMediaChunk(ws, data, parsed);
        break;
        
      case "stop":
        console.log("[Twilio Stream] ⏹️  Stream STOPPED");
        await handleStreamStop(ws, data, parsed);
        break;
    }
  } catch (error) {
    console.error("[Twilio Stream] ❌ Error:", error);
  }
}

async function handleStreamStart(ws: WebSocket, wsData: WebSocketData, data: TwilioStreamMessage) {
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
    
    wsData.openaiClient = openaiClient;
    wsData.callSid = callSid;
    wsData.streamSid = data.streamSid;
    
    openaiClient.onAudio((audioBase64) => {
      const pcmuAudio = pcm16ToPCMU(audioBase64);
      ws.send(JSON.stringify({
        event: "media",
        streamSid: wsData.streamSid,
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

async function handleMediaChunk(ws: WebSocket, wsData: WebSocketData, data: TwilioStreamMessage) {
  if (!data.media || data.media.track !== "inbound") return;
  
  if (!wsData.openaiClient) {
    wsData.audioChunkCount++;
    if (wsData.audioChunkCount % 50 === 1) {
      console.warn(`[Twilio Stream] ⚠️  OpenAI not ready - dropped ${wsData.audioChunkCount} chunks`);
    }
    return;
  }
  
  const pcm16Audio = pcmuToPCM16(data.media.payload);
  wsData.openaiClient.sendAudio(pcm16Audio);
}

async function handleStreamStop(ws: WebSocket, wsData: WebSocketData, data: TwilioStreamMessage) {
  if (wsData.openaiClient) {
    wsData.openaiClient.commitAudio();
    await new Promise(r => setTimeout(r, 1000));
    wsData.openaiClient.close();
  }
  ws.close();
}

