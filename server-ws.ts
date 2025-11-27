/**
 * Standalone WebSocket server for Twilio Media Streams
 * Uses Node.js http + ws (more compatible with Railway than Bun.serve)
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

console.log(`🚀 Starting WebSocket server on port ${PORT}...`);

interface WebSocketData {
  openaiClient?: any;
  callSid?: string;
  streamSid?: string;
  audioChunkCount: number;
}

// Store data per connection
const connectionData = new WeakMap<WebSocket, WebSocketData>();

// Create HTTP server
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("WebSocket server running! Connect to /twilio/stream");
    return;
  }
  
  res.writeHead(404);
  res.end("Not Found");
});

// Create WebSocket server
const wss = new WebSocketServer({ 
  server: httpServer,
  path: "/twilio/stream",
});

wss.on("connection", (ws: WebSocket) => {
  console.log("[WS] ✅ WebSocket CONNECTED");
  connectionData.set(ws, { audioChunkCount: 0 });
  
  ws.on("message", async (message: Buffer) => {
    try {
      const data = connectionData.get(ws)!;
      const parsed = JSON.parse(message.toString());
      
      if (parsed.event !== "media") {
        console.log("[Twilio] Event:", parsed.event);
      }
      
      switch (parsed.event) {
        case "connected":
          console.log("[Twilio] Connected, streamSid:", parsed.streamSid);
          break;
          
        case "start":
          await handleStart(ws, data, parsed);
          break;
          
        case "media":
          handleMedia(ws, data, parsed);
          break;
          
        case "stop":
          console.log("[Twilio] Stream stopped");
          if (data.openaiClient) {
            data.openaiClient.commitAudio();
            await new Promise(r => setTimeout(r, 500));
            data.openaiClient.close();
          }
          break;
      }
    } catch (error) {
      console.error("[WS] Message error:", error);
    }
  });
  
  ws.on("close", () => {
    console.log("[WS] ❌ WebSocket CLOSED");
    const data = connectionData.get(ws);
    if (data?.openaiClient) {
      data.openaiClient.close();
    }
  });
  
  ws.on("error", (error) => {
    console.error("[WS] Error:", error);
  });
});

// Start listening
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ WebSocket server listening on http://0.0.0.0:${PORT}`);
  console.log(`📡 Connect to: wss://your-domain/twilio/stream`);
});

async function handleStart(ws: WebSocket, wsData: WebSocketData, data: any) {
  const callSid = data.start?.callSid;
  if (!callSid) {
    console.error("[Twilio] No callSid in start event");
    return;
  }
  
  console.log("[Twilio] 🚀 Stream START, callSid:", callSid);
  wsData.callSid = callSid;
  wsData.streamSid = data.streamSid;
  
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
    
    wsData.openaiClient = openai;
    
    // Send OpenAI audio back to Twilio
    openai.onAudio((audioBase64: string) => {
      const pcmu = pcm16ToPCMU(audioBase64);
      ws.send(JSON.stringify({
        event: "media",
        streamSid: wsData.streamSid,
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

function handleMedia(ws: WebSocket, wsData: WebSocketData, data: any) {
  if (!data.media || data.media.track !== "inbound") return;
  
  if (!wsData.openaiClient) {
    wsData.audioChunkCount++;
    if (wsData.audioChunkCount % 100 === 1) {
      console.log("[Twilio] Waiting for OpenAI...", wsData.audioChunkCount, "chunks");
    }
    return;
  }
  
  // Lazy load audio converter
  import("./src/lib/realtime/audio-converter").then(({ pcmuToPCM16 }) => {
    const pcm16 = pcmuToPCM16(data.media.payload);
    wsData.openaiClient.sendAudio(pcm16);
  });
}
