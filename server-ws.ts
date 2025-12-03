/**
 * Standalone WebSocket server for Twilio Media Streams
 * Uses Node.js http + ws for Railway compatibility
 */

import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// Pre-import audio converter to avoid async import in hot path
let pcmuToPCM16Fn: ((payload: string) => string) | null = null;
let pcm16ToPCMUFn: ((payload: string) => string) | null = null;

async function loadAudioConverter() {
  const { pcmuToPCM16, pcm16ToPCMU } = await import("./src/lib/realtime/audio-converter");
  pcmuToPCM16Fn = pcmuToPCM16;
  pcm16ToPCMUFn = pcm16ToPCMU;
  console.log("[WS] Audio converter loaded");
}

// Load on startup
loadAudioConverter();

interface OpenAIRealtimeClientType {
  connect: () => Promise<void>;
  close: () => void;
  sendAudio: (base64: string) => void;
  commitAudio: () => void;
  onAudio: (callback: (audio: string) => void) => void;
  onTranscript: (callback: (text: string) => void) => void;
}

interface TwilioMessage {
  event: string;
  streamSid?: string;
  start?: {
    callSid: string;
  };
  media?: {
    track: string;
    payload: string;
  };
}

interface WebSocketData {
  openaiClient?: OpenAIRealtimeClientType;
  callSid?: string;
  streamSid?: string;
  audioChunkCount: number;
  audioBuffer: string[]; // Buffer audio while OpenAI is connecting
  openaiConnecting: boolean;
}

const connectionData = new WeakMap<WebSocket, WebSocketData>();

// In-memory cache for call data (keyed by callSid)
// This avoids DB queries in the critical path when call starts
interface CachedCallData {
  openaiPrompt: string;
  cachedAt: number; // Timestamp for cleanup
}

const callDataCache = new Map<string, CachedCallData>();

// Cleanup old cache entries (older than 1 hour) every 5 minutes
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  let cleaned = 0;
  for (const [callSid, data] of callDataCache.entries()) {
    if (now - data.cachedAt > oneHour) {
      callDataCache.delete(callSid);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[WS Cache] Cleaned up ${cleaned} old cache entries`);
  }
}, 5 * 60 * 1000); // Every 5 minutes

// HTTP server for health checks and cache management
const httpServer = createServer((req, res) => {
  // Health check
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("WebSocket server running");
    return;
  }

  // Cache endpoint: POST /cache/call to populate cache
  if (req.method === "POST" && req.url === "/cache/call") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const { callSid, openaiPrompt } = data;
        
        if (!callSid || !openaiPrompt) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing callSid or openaiPrompt" }));
          return;
        }

        callDataCache.set(callSid, {
          openaiPrompt,
          cachedAt: Date.now(),
        });
        
        console.log(`[WS Cache] ✅ Cached call data for ${callSid}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, callSid }));
      } catch (error) {
        console.error("[WS Cache] Error caching call data:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to cache call data" }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

// WebSocket server
const wss = new WebSocketServer({ server: httpServer, path: "/twilio/stream" });

wss.on("connection", (ws: WebSocket) => {
  console.log("[WS] Connected");
  connectionData.set(ws, { audioChunkCount: 0, audioBuffer: [], openaiConnecting: false });
  
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

async function handleStart(ws: WebSocket, wsData: WebSocketData, data: TwilioMessage) {
  const callSid = data.start?.callSid;
  if (!callSid) return;
  
  wsData.callSid = callSid;
  wsData.streamSid = data.streamSid;
  
  try {
    const { OpenAIRealtimeClient } = await import("./src/lib/realtime/openai-client");
    
    // ✅ Check cache first - avoids DB query in critical path
    let openaiPrompt: string | null = null;
    const cached = callDataCache.get(callSid);
    
    if (cached) {
      console.log(`[WS] ✅ Using cached call data for ${callSid} (saved ${Date.now() - cached.cachedAt}ms ago)`);
      openaiPrompt = cached.openaiPrompt;
    } else {
      // Fallback to DB query if not in cache (shouldn't happen normally)
      console.log(`[WS] ⚠️ Cache miss for ${callSid}, falling back to DB query`);
      const postgres = (await import("postgres")).default;
      const { drizzle } = await import("drizzle-orm/postgres-js");
      const { eq } = await import("drizzle-orm");
      const { calls } = await import("./src/lib/db/schema/calls");
      const schema = await import("./src/lib/db/schema");
      
      const driver = postgres(process.env.DATABASE_URL!);
      const db = drizzle({ client: driver, schema, casing: "snake_case" });
      
      const [call] = await db.select().from(calls).where(eq(calls.callSid, callSid)).limit(1);
      await driver.end();
      
      if (!call?.openaiPrompt) {
        console.error("[WS] Call not found or missing prompt:", callSid);
        return;
      }
      
      openaiPrompt = call.openaiPrompt;
    }
    
    if (!openaiPrompt) {
      console.error("[WS] No OpenAI prompt available for call:", callSid);
      return;
    }
    
    const openai = new OpenAIRealtimeClient({
      apiKey: process.env.OPENAI_API_KEY!,
      voice: "alloy",
      instructions: openaiPrompt,
    });
    
    await openai.connect();
    wsData.openaiClient = openai;
    
    // Flush any buffered audio that arrived while we were connecting
    if (wsData.audioBuffer.length > 0) {
      console.log(`[WS] 📤 Flushing ${wsData.audioBuffer.length} buffered audio chunks to OpenAI`);
      for (const chunk of wsData.audioBuffer) {
        if (pcmuToPCM16Fn) {
          openai.sendAudio(pcmuToPCM16Fn(chunk));
        }
      }
      wsData.audioBuffer = []; // Clear buffer
    }
    
    let audioSentCount = 0;
    openai.onAudio((audioBase64: string) => {
      audioSentCount++;
      if (audioSentCount === 1) {
        console.log("[WS] 🔊 First audio chunk sent to Twilio");
      }
      if (pcm16ToPCMUFn) {
      ws.send(JSON.stringify({
        event: "media",
        streamSid: wsData.streamSid,
          media: { payload: pcm16ToPCMUFn(audioBase64) },
      }));
      }
    });
    
    openai.onTranscript((text: string) => {
      console.log("[AI]", text);
    });
    
  } catch (error) {
    console.error("[WS] Start error:", error);
  }
}

function handleMedia(wsData: WebSocketData, data: TwilioMessage) {
  if (!data.media || data.media.track !== "inbound") return;
  
  wsData.audioChunkCount++;
  if (wsData.audioChunkCount === 1) {
    console.log("[WS] 🎤 First audio from Twilio received");
  }
  
  // If OpenAI is not ready, buffer the audio instead of dropping it
  if (!wsData.openaiClient) {
    // Buffer up to 3 seconds of audio (8kHz * 1 byte * 3 seconds / 20ms chunks ≈ 150 chunks)
    if (wsData.audioBuffer.length < 150) {
      wsData.audioBuffer.push(data.media.payload);
    }
    if (wsData.audioChunkCount % 50 === 1) {
      console.log("[WS] ⏳ Buffering audio while OpenAI connects...", wsData.audioBuffer.length, "chunks");
    }
    return;
  }
  
  // Use pre-loaded converter (no async import in hot path)
  if (pcmuToPCM16Fn) {
    wsData.openaiClient.sendAudio(pcmuToPCM16Fn(data.media.payload));
  }
}
