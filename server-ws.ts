/**
 * Standalone WebSocket server for Twilio Media Streams
 * Runs on PORT env var (Railway) or 3001 (local)
 */

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

console.log(`🚀 Starting WebSocket server on port ${PORT}...`);

const server = Bun.serve({
  port: PORT,
  
  fetch(req) {
    // Log EVERY request immediately
    console.log(`[WS] 📥 ${req.method} ${req.url}`);
    
    const url = new URL(req.url);
    
    // Health check / root path
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("WebSocket server is running! Connect to /twilio/stream", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    
    // WebSocket upgrade path
    if (url.pathname === "/twilio/stream") {
      console.log("[WS] 🔌 WebSocket upgrade requested");
      
      const upgradeHeader = req.headers.get("upgrade");
      if (upgradeHeader?.toLowerCase() !== "websocket") {
        console.log("[WS] ❌ Not a WebSocket request");
        return new Response("Expected WebSocket", { status: 426 });
      }
      
      const upgraded = server.upgrade(req, {
        data: { audioChunkCount: 0 },
      });
      
      if (!upgraded) {
        console.log("[WS] ❌ Upgrade failed");
        return new Response("WebSocket upgrade failed", { status: 500 });
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
    
    async message(ws, message) {
      // Lazy load heavy dependencies only when needed
      const { handleTwilioMessage } = await import("./src/lib/twilio/ws-handler");
      await handleTwilioMessage(ws, message);
    },
    
    close(ws) {
      console.log("[WS] ❌ WebSocket CLOSED");
    },
  },
});

console.log(`✅ WebSocket server running on http://localhost:${PORT}`);
console.log(`📡 Twilio connects to: wss://your-domain/twilio/stream`);
