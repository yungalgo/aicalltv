/**
 * Standalone WebSocket server for Twilio Media Streams
 * Uses Node.js http + ws for Railway compatibility
 */

import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

interface WebSocketData {
  openaiClient?: any;
  callSid?: string;
  streamSid?: string;
  audioChunkCount: number;
}

const connectionData = new WeakMap<WebSocket, WebSocketData>();

// HTTP server for health checks
const httpServer = createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("WebSocket server running");
    return;
  }
  res.writeHead(404);
  res.end("Not Found");
});

// WebSocket server
const wss = new WebSocketServer({ server: httpServer, path: "/twilio/stream" });

wss.on("connection", (ws: WebSocket) => {
  console.log("[WS] Connected");
  connectionData.set(ws, { audioChunkCount: 0 });
  
  ws.on("message", async (message: Buffer) => {
    try {
      const data = connectionData.get(ws)!;
      const parsed = JSON.parse(message.toString());
      
      switch (parsed.event) {
        case "start":
          await handleStart(ws, data, parsed);
          break;
        case "media":
          handleMedia(data, parsed);
          break;
        case "stop":
          if (data.openaiClient) {
            data.openaiClient.commitAudio();
            await new Promise(r => setTimeout(r, 500));
            data.openaiClient.close();
          }
          break;
      }
    } catch (error) {
      console.error("[WS] Error:", error);
    }
  });
  
  ws.on("close", () => {
    const data = connectionData.get(ws);
    if (data?.openaiClient) data.openaiClient.close();
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});

async function handleStart(ws: WebSocket, wsData: WebSocketData, data: any) {
  const callSid = data.start?.callSid;
  if (!callSid) return;
  
  wsData.callSid = callSid;
  wsData.streamSid = data.streamSid;
  
  try {
    const postgres = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { eq } = await import("drizzle-orm");
    const { calls } = await import("./src/lib/db/schema/calls");
    const schema = await import("./src/lib/db/schema");
    const { OpenAIRealtimeClient } = await import("./src/lib/realtime/openai-client");
    const { pcm16ToPCMU } = await import("./src/lib/realtime/audio-converter");
    
    const driver = postgres(process.env.DATABASE_URL!);
    const db = drizzle({ client: driver, schema, casing: "snake_case" });
    
    const [call] = await db.select().from(calls).where(eq(calls.callSid, callSid)).limit(1);
    await driver.end();
    
    if (!call?.openaiPrompt) {
      console.error("[WS] Call not found or missing prompt:", callSid);
      return;
    }
    
    const openai = new OpenAIRealtimeClient({
      apiKey: process.env.OPENAI_API_KEY!,
      voice: "alloy",
      instructions: call.openaiPrompt,
    });
    
    await openai.connect();
    wsData.openaiClient = openai;
    
    let audioSentCount = 0;
    openai.onAudio((audioBase64: string) => {
      audioSentCount++;
      if (audioSentCount === 1) {
        console.log("[WS] 🔊 First audio chunk sent to Twilio");
      }
      ws.send(JSON.stringify({
        event: "media",
        streamSid: wsData.streamSid,
        media: { payload: pcm16ToPCMU(audioBase64) },
      }));
    });
    
    openai.onTranscript((text: string) => {
      console.log("[AI]", text);
    });
    
  } catch (error) {
    console.error("[WS] Start error:", error);
  }
}

function handleMedia(wsData: WebSocketData, data: any) {
  if (!data.media || data.media.track !== "inbound") return;
  
  wsData.audioChunkCount++;
  if (wsData.audioChunkCount === 1) {
    console.log("[WS] 🎤 First audio from Twilio received");
  }
  
  if (!wsData.openaiClient) {
    if (wsData.audioChunkCount % 100 === 1) {
      console.log("[WS] ⏳ Waiting for OpenAI...", wsData.audioChunkCount, "chunks");
    }
    return;
  }
  
  import("./src/lib/realtime/audio-converter").then(({ pcmuToPCM16 }) => {
    wsData.openaiClient.sendAudio(pcmuToPCM16(data.media.payload));
  });
}
