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
  ConversationTurn,
} from "./src/lib/conversation-relay/types";

const PORT = process.env.RELAY_PORT ? parseInt(process.env.RELAY_PORT) : 3002;

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
    console.log(`[Relay Cache] Cleaned up ${cleaned} old cache entries`);
  }
}, 5 * 60 * 1000);

// HTTP server for health checks and cache
const httpServer = createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ConversationRelay WebSocket server running");
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
        
        console.log(`[Relay Cache] ✅ Cached call data for ${callSid}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, callSid }));
      } catch (error) {
        console.error("[Relay Cache] Error caching call data:", error);
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
const wss = new WebSocketServer({ server: httpServer, path: "/conversation-relay" });

wss.on("connection", (ws: WebSocket, req) => {
  console.log("=".repeat(60));
  console.log("[Relay] 🔌 NEW WEBSOCKET CONNECTION");
  console.log(`[Relay]   URL: ${req.url}`);
  console.log(`[Relay]   Headers: ${JSON.stringify(req.headers, null, 2)}`);
  console.log("=".repeat(60));
  
  let currentSession: ConversationSession | null = null;
  let chatClient: InstanceType<typeof import("./src/lib/conversation-relay/openai-chat").OpenAIChatClient> | null = null;
  let messageCount = 0;

  ws.on("message", async (data: Buffer) => {
    messageCount++;
    const rawData = data.toString();
    console.log(`[Relay] 📥 RAW MESSAGE #${messageCount}: ${rawData.substring(0, 500)}`);
    
    try {
      const message = JSON.parse(rawData) as IncomingRelayMessage;
      
      console.log(`[Relay] 📥 Parsed type: ${message.type}`);

      switch (message.type) {
        case "setup":
          console.log("[Relay] 🚀 SETUP MESSAGE RECEIVED");
          console.log("[Relay]   Full setup:", JSON.stringify(message, null, 2));
          await handleSetup(ws, message as SetupMessage);
          break;

        case "prompt":
          console.log("[Relay] 🎤 PROMPT MESSAGE RECEIVED");
          console.log("[Relay]   voicePrompt:", (message as PromptMessage).voicePrompt);
          console.log("[Relay]   confidence:", (message as PromptMessage).confidence);
          console.log("[Relay]   lang:", (message as PromptMessage).lang);
          await handlePrompt(ws, message as PromptMessage);
          break;

        case "interrupt":
          console.log("[Relay] ⚡ INTERRUPT MESSAGE RECEIVED");
          handleInterrupt(ws, message as InterruptMessage);
          break;

        case "dtmf":
          console.log(`[Relay] 📱 DTMF digit: ${(message as { digit: string }).digit}`);
          break;

        case "agentSpeaking":
          console.log("[Relay] 🔊 Agent started speaking");
          break;

        case "clientSpeaking":
          console.log("[Relay] 🎤 CLIENT STARTED SPEAKING (Deepgram detected voice)");
          break;

        case "error":
          console.error("[Relay] ❌ ERROR FROM TWILIO:", JSON.stringify(message, null, 2));
          break;

        case "info":
          // Info messages from ConversationRelay - might contain important debug info
          console.log("[Relay] ℹ️  INFO:", JSON.stringify(message, null, 2));
          break;

        default:
          console.log("[Relay] ❓ UNKNOWN MESSAGE TYPE:", message.type);
          console.log("[Relay]   Full message:", JSON.stringify(message, null, 2));
      }
    } catch (error) {
      console.error("[Relay] Error processing message:", error);
    }
  });

  ws.on("close", (code, reason) => {
    console.log("=".repeat(60));
    console.log("[Relay] 🔌 WEBSOCKET CLOSED");
    console.log(`[Relay]   Code: ${code}`);
    console.log(`[Relay]   Reason: ${reason?.toString() || 'none'}`);
    console.log(`[Relay]   Total messages received: ${messageCount}`);
    if (currentSession) {
      console.log(`[Relay]   Conversation turns: ${currentSession.conversation.length}`);
      sessions.delete(currentSession.sessionId);
    }
    console.log("=".repeat(60));
  });

  ws.on("error", (error) => {
    console.error("[Relay] ❌ WEBSOCKET ERROR:", error);
  });

  // Handle setup message
  async function handleSetup(ws: WebSocket, message: SetupMessage) {
    const { sessionId, callSid, customParameters } = message;
    
    console.log("=".repeat(60));
    console.log("[Relay] 🚀 HANDLING SETUP");
    console.log(`[Relay]   Session ID: ${sessionId}`);
    console.log(`[Relay]   Call SID: ${callSid}`);
    console.log(`[Relay]   From: ${message.from}`);
    console.log(`[Relay]   To: ${message.to}`);
    console.log(`[Relay]   Direction: ${message.direction}`);
    console.log(`[Relay]   Custom params:`, JSON.stringify(customParameters, null, 2));
    console.log("=".repeat(60));

    // Get OpenAI prompt from cache or DB
    let openaiPrompt = "You are a helpful assistant on a phone call. Be concise and conversational.";
    
    const cached = callDataCache.get(callSid);
    if (cached) {
      console.log(`[Relay] ✅ Using cached prompt for ${callSid}`);
      openaiPrompt = cached.openaiPrompt;
    } else {
      // Fallback to DB query
      console.log(`[Relay] ⚠️ Cache miss for ${callSid}, trying DB...`);
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
        console.error("[Relay] DB query failed:", error);
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

    console.log("[Relay] ✅ Session initialized with prompt:");
    console.log(`[Relay]   "${openaiPrompt.substring(0, 100)}..."`);
    console.log("[Relay] 🎧 Now waiting for user speech (prompt messages from Deepgram)...");
  }

  // Handle prompt (user speech transcribed)
  async function handlePrompt(ws: WebSocket, message: PromptMessage) {
    if (!currentSession || !chatClient) {
      console.error("[Relay] No session or chat client");
      return;
    }

    if (currentSession.isProcessing) {
      console.log("[Relay] ⏳ Already processing, ignoring prompt");
      return;
    }

    const userText = message.voicePrompt;
    console.log(`[Relay] 🎤 User said: "${userText}"`);

    // Add user turn to conversation
    currentSession.conversation.push({
      role: "user",
      content: userText,
      timestamp: Date.now(),
    });

    currentSession.isProcessing = true;

    try {
      // Stream response from OpenAI, buffering into word groups for smooth TTS
      let tokenCount = 0;
      let buffer = "";
      let chunksSent = 0;
      
      const sendChunk = (text: string, isLast: boolean) => {
        if (text.trim() || isLast) {
          const msg = {
            type: "text",
            token: text,
            last: isLast,
          };
          if (chunksSent < 5) {
            console.log(`[Relay] 📤 CHUNK #${chunksSent + 1}:`, JSON.stringify(msg));
          }
          chunksSent++;
          ws.send(JSON.stringify(msg));
        }
      };
      
      const fullResponse = await chatClient.streamResponse(
        currentSession.conversation,
        (token) => {
          tokenCount++;
          buffer += token;
          
          // Send in small word groups (3-5 words) for smooth interrupts
          // Count spaces to estimate word count
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

      console.log(`[Relay] ✅ Processed ${tokenCount} tokens into ${chunksSent} chunks`);
      console.log(`[Relay] 📝 Full response: "${fullResponse.substring(0, 150)}..."`)

      // Add assistant turn to conversation
      currentSession.conversation.push({
        role: "assistant",
        content: fullResponse,
        timestamp: Date.now(),
      });

      currentSession.lastAssistantResponse = fullResponse;
    } catch (error) {
      console.error("[Relay] Error getting AI response:", error);
      
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
    console.log(`[Relay] ⚡ Interrupted! Heard up to: "${utteranceUntilInterrupt}"`);

    // Find and truncate the last assistant message
    // Using reverse loop since findLastIndex may not be available in all targets
    let lastAssistantIndex = -1;
    for (let i = currentSession.conversation.length - 1; i >= 0; i--) {
      if (currentSession.conversation[i].role === "assistant") {
        lastAssistantIndex = i;
        break;
      }
    }

    if (lastAssistantIndex !== -1) {
      const lastTurn = currentSession.conversation[lastAssistantIndex];
      
      // Find where the interruption occurred
      const interruptPosition = lastTurn.content.indexOf(utteranceUntilInterrupt);
      
      if (interruptPosition !== -1) {
        // Truncate to what was actually heard
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

        console.log(`[Relay] 📝 Truncated assistant response to: "${truncatedContent.substring(0, 50)}..."`);
      }
    }

    // Reset processing state so we can handle the next prompt
    currentSession.isProcessing = false;
  }
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("=".repeat(60));
  console.log(`🎙️  ConversationRelay WebSocket server listening on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   WebSocket: ws://localhost:${PORT}/conversation-relay`);
  console.log("=".repeat(60));
});

