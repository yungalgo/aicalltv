/**
 * Standalone WebSocket server for Twilio Media Streams
 * Runs on port 3001 (separate from main app on 3000)
 * 
 * Why separate? TanStack Start + Nitro v3 alpha doesn't properly handle WebSocket routes yet.
 * This is a simple Bun WebSocket server that Twilio can connect to.
 * 
 * Usage: bun run server-ws.ts
 */

import { ServerWebSocket } from "bun";
import { OpenAIRealtimeClient } from "./src/lib/realtime/openai-client";
import { pcmuToPCM16, pcm16ToPCMU } from "./src/lib/realtime/audio-converter";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { env } from "./src/env/server";
import { calls } from "./src/lib/db/schema/calls";
import * as schema from "./src/lib/db/schema";

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

const server = Bun.serve<WebSocketData>({
  port: 3001,
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async fetch(req: any, server: any) {
    const url = new URL(req.url);
    
    if (url.pathname === "/twilio/stream") {
      console.log("[WS Server] 🔌 WebSocket upgrade request received");
      
      const upgraded = server.upgrade(req, {
        data: {
          audioChunkCount: 0,
        },
      });
      
      if (!upgraded) {
        console.error("[WS Server] ❌ Failed to upgrade to WebSocket");
        return new Response("WebSocket upgrade failed", { status: 426 });
      }
      
      return undefined; // Upgraded successfully
    }
    
    return new Response("WebSocket server for Twilio Media Streams\nConnect to /twilio/stream", {
      status: 200,
    });
  },
  
  websocket: {
    async open(ws: ServerWebSocket<WebSocketData>) {
      console.log("[Twilio Stream] ✅ WebSocket connection OPENED");
    },
    
    async message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
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
    },
    
    async close(ws: ServerWebSocket<WebSocketData>) {
      console.log("[Twilio Stream] ❌ Connection CLOSED");
      
      if (ws.data.openaiClient) {
        ws.data.openaiClient.close();
      }
    },
  },
});

console.log("🚀 WebSocket server running on http://localhost:3001");
console.log("📡 Twilio should connect to: ws://localhost:3001/twilio/stream");
console.log("   (or via ngrok: wss://your-ngrok-url.ngrok-free.app/twilio/stream)");

async function handleStreamStart(ws: ServerWebSocket<WebSocketData>, data: TwilioStreamMessage) {
  const callSid = data.start?.callSid;
  
  if (!callSid) {
    console.error("[Twilio Stream] ❌ No callSid");
    return;
  }
  
  console.log("[Twilio Stream] Call SID:", callSid);
  
  // Fetch call from database
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
    console.log("[Twilio Stream] 🔍 Checking call readiness...");
    console.log("[Twilio Stream]   Status:", call.status);
    console.log("[Twilio Stream]   Has OpenAI prompt:", !!call.openaiPrompt);
    
    // CRITICAL: OpenAI prompt MUST be ready before call can start
    if (!call.openaiPrompt) {
      console.error(`[Twilio Stream] ❌ Call ${call.id} missing OpenAI prompt!`);
      console.error(`[Twilio Stream]   Status: ${call.status}`);
      console.error(`[Twilio Stream]   Call cannot start without prompt. This should not happen if flow is correct.`);
      throw new Error(`[WebSocket] ❌ Missing OpenAI prompt for call ${call.id}. Prompt must be ready before call starts. Status: ${call.status}`);
    }
    
    // Verify status is prompt_ready (or at least not call_created)
    if (call.status === "call_created") {
      console.error(`[Twilio Stream] ❌ Call ${call.id} still in call_created status - prompt generation may have failed`);
      throw new Error(`[WebSocket] ❌ Call ${call.id} not ready - still in call_created status`);
    }
    
    console.log("[Twilio Stream] ✅ Call is ready - has prompt and valid status");

    const openaiClient = new OpenAIRealtimeClient({
      apiKey: env.OPENAI_API_KEY!,
      voice: "alloy",
      instructions: call.openaiPrompt,
    });
    
    console.log("[Twilio Stream] 🔌 Connecting to OpenAI...");
    await openaiClient.connect();
    console.log("[Twilio Stream] ✅ OpenAI connected");
    
    ws.data.openaiClient = openaiClient;
    ws.data.callSid = callSid;
    ws.data.streamSid = data.streamSid;
    
    // Send OpenAI audio back to Twilio
    openaiClient.onAudio((audioBase64) => {
      const pcmuAudio = pcm16ToPCMU(audioBase64);
      ws.send(JSON.stringify({
        event: "media",
        streamSid: ws.data.streamSid,
        media: {
          payload: pcmuAudio,
        },
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
    console.warn("[Twilio Stream] ⚠️  OpenAI not ready");
    return;
  }
  
  const pcm16Audio = pcmuToPCM16(data.media.payload);
  ws.data.openaiClient.sendAudio(pcm16Audio);
  
  ws.data.audioChunkCount++;
  if (ws.data.audioChunkCount === 1) {
    console.log("[Twilio Stream] ✅ First audio chunk sent to OpenAI");
  }
}

async function handleStreamStop(ws: ServerWebSocket<WebSocketData>, data: TwilioStreamMessage) {
  if (ws.data.openaiClient) {
    ws.data.openaiClient.commitAudio();
    await new Promise(r => setTimeout(r, 1000));
    ws.data.openaiClient.close();
  }
  ws.close();
}

