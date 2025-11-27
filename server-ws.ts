/**
 * Standalone WebSocket server for Twilio Media Streams
 * Uses Node.js http + ws library (more compatible with Railway than Bun.serve)
 */

import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

console.log(`🚀 Starting WebSocket server on port ${PORT}...`);

// Create HTTP server
const httpServer = createServer((req, res) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("WebSocket server is running! Connect to /twilio/stream");
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

interface WebSocketData {
  openaiClient?: any;
  callSid?: string;
  streamSid?: string;
  audioChunkCount: number;
}

// Store data per connection
const connectionData = new WeakMap<WebSocket, WebSocketData>();

wss.on("connection", (ws) => {
  console.log("[WS] ✅ WebSocket CONNECTED");
  
  connectionData.set(ws, { audioChunkCount: 0 });
  
  ws.on("message", async (message) => {
    try {
      const data = connectionData.get(ws)!;
      const { handleTwilioMessage } = await import("./src/lib/twilio/ws-handler-node");
      await handleTwilioMessage(ws, data, message.toString());
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

httpServer.listen(PORT, () => {
  console.log(`✅ WebSocket server running on http://localhost:${PORT}`);
  console.log(`📡 Twilio connects to: wss://your-domain/twilio/stream`);
});
