/**
 * WebSocket server for Twilio ConversationRelay
 * 
 * Handles text-based conversations with:
 * - ElevenLabs TTS (handled by Twilio)
 * - Deepgram STT (handled by Twilio)
 * - OpenAI Chat for AI responses
 * - Built-in interruption handling
 */

import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type {
  IncomingRelayMessage,
  SetupMessage,
  PromptMessage,
  InterruptMessage,
  ConversationSession,
} from "./src/lib/conversation-relay/types";

const PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3001;

// Session storage
const sessions = new Map<string, ConversationSession>();

// OpenAI Chat Client (lazy loaded)
let OpenAIChatClientClass: typeof import("./src/lib/conversation-relay/openai-chat").OpenAIChatClient | null = null;

async function getOpenAIChatClient() {
  if (!OpenAIChatClientClass) {
    const module = await import("./src/lib/conversation-relay/openai-chat");
    OpenAIChatClientClass = module.OpenAIChatClient;
  }
  return OpenAIChatClientClass;
}

// In-memory cache for call data (keyed by callSid)
interface CachedCallData {
  openaiPrompt: string;
  welcomeGreeting?: string;
  cachedAt: number;
}
const callDataCache = new Map<string, CachedCallData>();

// Cleanup old cache entries every 5 minutes
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
    console.log(`[WS] Cleaned up ${cleaned} old cache entries`);
  }
}, 5 * 60 * 1000);

// HTTP server for health checks and cache
const httpServer = createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("WebSocket server running (ConversationRelay)");
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
        const { callSid, openaiPrompt, welcomeGreeting } = data;
        
        if (!callSid || !openaiPrompt) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing callSid or openaiPrompt" }));
          return;
        }

        callDataCache.set(callSid, {
          openaiPrompt,
          welcomeGreeting,
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

// WebSocket server for ConversationRelay
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws: WebSocket, req) => {
  console.log("=".repeat(60));
  console.log("[WS] 🔌 NEW CONNECTION");
  console.log(`[WS]   URL: ${req.url}`);
  console.log("=".repeat(60));
  
  let currentSession: ConversationSession | null = null;
  let chatClient: InstanceType<typeof import("./src/lib/conversation-relay/openai-chat").OpenAIChatClient> | null = null;

  ws.on("message", async (data: Buffer) => {
    const rawData = data.toString();
    
    try {
      const message = JSON.parse(rawData) as IncomingRelayMessage;
      
      // Only log non-info messages to reduce noise
      if (message.type !== "info") {
        console.log(`[WS] 📥 ${message.type}`);
      }

      switch (message.type) {
        case "setup":
          await handleSetup(ws, message as SetupMessage);
          break;

        case "prompt":
          console.log(`[WS] 🎤 User: "${(message as PromptMessage).voicePrompt}"`);
          await handlePrompt(ws, message as PromptMessage);
          break;

        case "interrupt":
          handleInterrupt(ws, message as InterruptMessage);
          break;

        case "dtmf":
          console.log(`[WS] 📱 DTMF: ${(message as { digit: string }).digit}`);
          break;

        case "info": {
          // Suppress most info messages, only log important ones
          const info = message as { name?: string; value?: string };
          if (info.name === "clientSpeaking" && info.value === "on") {
            console.log("[WS] 🎤 User speaking...");
          }
          break;
        }

        case "error":
          console.error("[WS] ❌ ERROR:", JSON.stringify(message, null, 2));
          break;

        default:
          // Ignore unknown message types
          break;
      }
    } catch (error) {
      console.error("[WS] Error processing message:", error);
    }
  });

  ws.on("close", (code) => {
    console.log(`[WS] 🔌 Connection closed (code: ${code})`);
    if (currentSession) {
      sessions.delete(currentSession.sessionId);
    }
  });

  ws.on("error", (error) => {
    console.error("[WS] ❌ Error:", error);
  });

  // Handle setup message
  async function handleSetup(ws: WebSocket, message: SetupMessage) {
    const { sessionId, callSid } = message;
    
    console.log(`[WS] 🚀 Setup - Session: ${sessionId}, Call: ${callSid}`);

    // Get OpenAI prompt from cache or DB
    let openaiPrompt = "You are a helpful assistant on a phone call. Be concise and conversational.";
    
    const cached = callDataCache.get(callSid);
    if (cached) {
      console.log(`[WS] ✅ Using cached prompt`);
      openaiPrompt = cached.openaiPrompt;
    } else {
      // Fallback to DB query
      console.log(`[WS] ⚠️ Cache miss, querying DB...`);
      try {
        const postgres = (await import("postgres")).default;
        const { drizzle } = await import("drizzle-orm/postgres-js");
        const { eq } = await import("drizzle-orm");
        const { calls } = await import("./src/lib/db/schema/calls");
        const schema = await import("./src/lib/db/schema");
        
        const driver = postgres(process.env.DATABASE_URL!);
        const db = drizzle({ client: driver, schema, casing: "snake_case" });
        
        const [call] = await db.select().from(calls).where(eq(calls.callSid, callSid)).limit(1);
        await driver.end();
        
        if (call?.openaiPrompt) {
          openaiPrompt = call.openaiPrompt;
        }
      } catch (error) {
        console.error("[WS] DB query failed:", error);
      }
    }

    // Initialize chat client
    const OpenAIChatClient = await getOpenAIChatClient();
    chatClient = new OpenAIChatClient({
      apiKey: process.env.OPENAI_API_KEY!,
      model: "gpt-4o-mini",
      systemPrompt: openaiPrompt,
    });

    // Create session
    currentSession = {
      sessionId,
      callSid,
      openaiPrompt,
      conversation: [],
      isProcessing: false,
    };
    sessions.set(sessionId, currentSession);

    console.log(`[WS] ✅ Ready - waiting for user speech...`);
  }

  // Handle prompt (user speech transcribed)
  async function handlePrompt(ws: WebSocket, message: PromptMessage) {
    if (!currentSession || !chatClient) {
      console.error("[WS] No session or chat client");
      return;
    }

    if (currentSession.isProcessing) {
      console.log("[WS] ⏳ Already processing, ignoring");
      return;
    }

    const userText = message.voicePrompt;

    // Add user turn to conversation
    currentSession.conversation.push({
      role: "user",
      content: userText,
      timestamp: Date.now(),
    });

    currentSession.isProcessing = true;

    try {
      // Stream response from OpenAI, buffering into word groups for smooth TTS
      let buffer = "";
      
      const sendChunk = (text: string, isLast: boolean) => {
        if (text.trim() || isLast) {
          ws.send(JSON.stringify({
            type: "text",
            token: text,
            last: isLast,
          }));
        }
      };
      
      const fullResponse = await chatClient.streamResponse(
        currentSession.conversation,
        (token) => {
          buffer += token;
          
          // Send in small word groups (3-5 words) for smooth interrupts
          const wordCount = (buffer.match(/\s+/g) || []).length;
          
          // Send every 3-4 words OR on sentence boundaries
          const shouldSend = wordCount >= 3 || 
                            (buffer.length > 5 && /[.!?,;:\n]$/.test(buffer.trim()));
          
          if (shouldSend && buffer.trim()) {
            sendChunk(buffer, false);
            buffer = "";
          }
        }
      );

      // Send any remaining buffer
      if (buffer.trim()) {
        sendChunk(buffer, false);
      }
      
      // Send final empty token with last: true
      sendChunk("", true);

      console.log(`[WS] 🤖 AI: "${fullResponse.substring(0, 80)}..."`);

      // Add assistant turn to conversation
      currentSession.conversation.push({
        role: "assistant",
        content: fullResponse,
        timestamp: Date.now(),
      });

      currentSession.lastAssistantResponse = fullResponse;
    } catch (error) {
      console.error("[WS] Error getting AI response:", error);
      
      // Send error message to user
      ws.send(JSON.stringify({
        type: "text",
        token: "I'm sorry, I encountered an error. Could you please repeat that?",
        last: true,
      }));
    } finally {
      currentSession.isProcessing = false;
    }
  }

  // Handle interrupt (user interrupted AI)
  function handleInterrupt(ws: WebSocket, message: InterruptMessage) {
    if (!currentSession) return;

    const { utteranceUntilInterrupt } = message;
    console.log(`[WS] ⚡ Interrupted at: "${utteranceUntilInterrupt.substring(0, 30)}..."`);

    // Find and truncate the last assistant message
    let lastAssistantIndex = -1;
    for (let i = currentSession.conversation.length - 1; i >= 0; i--) {
      if (currentSession.conversation[i].role === "assistant") {
        lastAssistantIndex = i;
        break;
      }
    }

    if (lastAssistantIndex !== -1) {
      const lastTurn = currentSession.conversation[lastAssistantIndex];
      const interruptPosition = lastTurn.content.indexOf(utteranceUntilInterrupt);
      
      if (interruptPosition !== -1) {
        const truncatedContent = lastTurn.content.substring(
          0,
          interruptPosition + utteranceUntilInterrupt.length
        );

        currentSession.conversation[lastAssistantIndex] = {
          ...lastTurn,
          content: truncatedContent,
          wasInterrupted: true,
          interruptedAt: utteranceUntilInterrupt,
        };
      }
    }

    currentSession.isProcessing = false;
  }
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("=".repeat(60));
  console.log(`🎙️  WebSocket server listening on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
  console.log("=".repeat(60));
});

