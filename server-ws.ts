/**
 * Standalone WebSocket server for Twilio Media Streams
 * Uses lazy loading to avoid startup crashes from missing env vars
 */

import { ServerWebSocket } from "bun";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

console.log(`🚀 Starting WebSocket server on port ${PORT}...`);

interface TwilioStreamMessage {
  event: "connected" | "start" | "media" | "stop";
  streamSid?: string;
  start?: { callSid: string };
  media?: { track: string; payload: string };
  stop?: { callSid: string };
}

interface WebSocketData {
  openaiClient?: any;
  callSid?: string;
  streamSid?: string;
  audioChunkCount: number;
}

const server = Bun.serve<WebSocketData>({
  port: PORT,
  
  fetch(req, server) {
    const url = new URL(req.url);
    console.log(`[WS] 📥 ${req.method} ${url.pathname}`);
    
    // Health check
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("WebSocket server running! Connect to /twilio/stream", { status: 200 });
    }
    
    // WebSocket upgrade
    if (url.pathname === "/twilio/stream") {
      const upgrade = req.headers.get("upgrade");
      if (upgrade?.toLowerCase() !== "websocket") {
        return new Response("WebSocket upgrade required", { status: 426 });
      }
      
      const upgraded = server.upgrade(req, { data: { audioChunkCount: 0 } });
      if (!upgraded) {
        return new Response("Upgrade failed", { status: 500 });
      }
      console.log("[WS] ✅ Upgraded to WebSocket");
      return undefined;
    }
    
    return new Response("Not Found", { status: 404 });
  },
  
  websocket: {
    open(ws) {
      console.log("[WS] ✅ WebSocket OPENED");
    },
    
    async message(ws: ServerWebSocket<WebSocketData>, message) {
      try {
        const data: TwilioStreamMessage = JSON.parse(message.toString());
        
        if (data.event !== "media") {
          console.log("[Twilio] Event:", data.event);
        }
        
        switch (data.event) {
          case "connected":
            console.log("[Twilio] Connected, streamSid:", data.streamSid);
            break;
            
          case "start":
            await handleStart(ws, data);
            break;
            
          case "media":
            handleMedia(ws, data);
            break;
            
          case "stop":
            console.log("[Twilio] Stream stopped");
            if (ws.data.openaiClient) {
              ws.data.openaiClient.commitAudio();
              await new Promise(r => setTimeout(r, 500));
              ws.data.openaiClient.close();
            }
            break;
        }
      } catch (error) {
        console.error("[WS] Message error:", error);
      }
    },
    
    close(ws) {
      console.log("[WS] ❌ WebSocket CLOSED");
      if (ws.data.openaiClient) {
        ws.data.openaiClient.close();
      }
    },
  },
});

console.log(`✅ WebSocket server running on http://localhost:${PORT}`);
console.log(`📡 Connect to: wss://your-domain/twilio/stream`);

async function handleStart(ws: ServerWebSocket<WebSocketData>, data: TwilioStreamMessage) {
  const callSid = data.start?.callSid;
  if (!callSid) {
    console.error("[Twilio] No callSid in start event");
    return;
  }
  
  console.log("[Twilio] 🚀 Stream START, callSid:", callSid);
  ws.data.callSid = callSid;
  ws.data.streamSid = data.streamSid;
  
  try {
    // Lazy load dependencies
    const postgres = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { eq } = await import("drizzle-orm");
    const { calls } = await import("./src/lib/db/schema/calls");
    const schema = await import("./src/lib/db/schema");
    const { OpenAIRealtimeClient } = await import("./src/lib/realtime/openai-client");
    const { pcm16ToPCMU } = await import("./src/lib/realtime/audio-converter");
    
    const DATABASE_URL = process.env.DATABASE_URL!;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
    
    // Fetch call from DB
    const driver = postgres(DATABASE_URL);
    const db = drizzle({ client: driver, schema, casing: "snake_case" });
    
    const [call] = await db.select().from(calls).where(eq(calls.callSid, callSid)).limit(1);
    await driver.end();
    
    if (!call) {
      console.error("[Twilio] Call not found:", callSid);
      return;
    }
    
    if (!call.openaiPrompt) {
      console.error("[Twilio] Call missing OpenAI prompt");
      return;
    }
    
    console.log("[Twilio] Found call:", call.id);
    
    // Connect to OpenAI
    const openai = new OpenAIRealtimeClient({
      apiKey: OPENAI_API_KEY,
      voice: "alloy",
      instructions: call.openaiPrompt,
    });
    
    await openai.connect();
    console.log("[Twilio] ✅ Connected to OpenAI");
    
    ws.data.openaiClient = openai;
    
    // Send OpenAI audio back to Twilio
    openai.onAudio((audioBase64: string) => {
      const pcmu = pcm16ToPCMU(audioBase64);
      ws.send(JSON.stringify({
        event: "media",
        streamSid: ws.data.streamSid,
        media: { payload: pcmu },
      }));
    });
    
    openai.onTranscript((text: string) => {
      console.log("[OpenAI] 📝", text);
    });
    
  } catch (error) {
    console.error("[Twilio] Start error:", error);
  }
}

function handleMedia(ws: ServerWebSocket<WebSocketData>, data: TwilioStreamMessage) {
  if (!data.media || data.media.track !== "inbound") return;
  
  if (!ws.data.openaiClient) {
    ws.data.audioChunkCount++;
    if (ws.data.audioChunkCount % 100 === 1) {
      console.log("[Twilio] Waiting for OpenAI...", ws.data.audioChunkCount, "chunks");
    }
    return;
  }
  
  // Lazy load audio converter (should be cached after first import)
  import("./src/lib/realtime/audio-converter").then(({ pcmuToPCM16 }) => {
    const pcm16 = pcmuToPCM16(data.media!.payload);
    ws.data.openaiClient.sendAudio(pcm16);
  });
}
