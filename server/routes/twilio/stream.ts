/**
 * Nitro WebSocket handler for Twilio Media Streams
 * This file goes in server/routes/ (Nitro convention)
 * 
 * Path: /twilio/stream (automatically handles WebSocket upgrade)
 * 
 * Architecture:
 * Twilio Call → Media Stream (WS) → This Handler → OpenAI Realtime API (WS)
 */

// @ts-expect-error - crossws types not fully available
import { defineWebSocketHandler } from "crossws/adapters/nitro";
import { OpenAIRealtimeClient } from "../../../src/lib/realtime/openai-client";
import { pcmuToPCM16, pcm16ToPCMU } from "../../../src/lib/realtime/audio-converter";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { env } from "../../../src/env/server";
import { calls } from "../../../src/lib/db/schema/calls";
import * as schema from "../../../src/lib/db/schema";

interface TwilioStreamMessage {
  event: "connected" | "start" | "media" | "stop";
  streamSid?: string;
  start?: {
    callSid: string;
    customParameters?: {
      callSid?: string;
    };
  };
  media?: {
    track: "inbound" | "outbound";
    chunk: string;
    timestamp: string;
    payload: string; // Base64 encoded PCMU audio
  };
  stop?: {
    callSid: string;
  };
}

export default defineWebSocketHandler({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async open(peer: any) {
    console.log("[Twilio Stream] ✅ WebSocket connection OPENED");
    console.log("[Twilio Stream] Peer ID:", peer.id);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async message(peer: any, message: any) {
    try {
      const data: TwilioStreamMessage = JSON.parse(message.text());
      
      // Log all events except media (too noisy)
      if (data.event !== "media") {
        console.log("[Twilio Stream] 📥 Event:", data.event, JSON.stringify(data, null, 2));
      }

      switch (data.event) {
        case "connected":
          console.log("[Twilio Stream] ✅ Stream connected:", data.streamSid);
          break;

        case "start":
          console.log("[Twilio Stream] 🚀 Stream STARTED - initializing OpenAI...");
          await handleStreamStart(peer, data);
          break;

        case "media":
          await handleMediaChunk(peer, data);
          break;

        case "stop":
          console.log("[Twilio Stream] ⏹️  Stream STOPPED");
          await handleStreamStop(peer, data);
          break;

        default:
          console.log("[Twilio Stream] ❓ Unknown event:", data.event);
      }
    } catch (error) {
      console.error("[Twilio Stream] ❌ Error processing message:", error);
      console.error("[Twilio Stream] Error stack:", error instanceof Error ? error.stack : error);
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async close(peer: any, details: any) {
    console.log("[Twilio Stream] ❌ Connection CLOSED:", details.code, details.reason);
    
    // Clean up OpenAI connection if exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const openaiClient = (peer as any).openaiClient as OpenAIRealtimeClient | undefined;
    if (openaiClient) {
      openaiClient.close();
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async error(peer: any, error: any) {
    console.error("[Twilio Stream] ❌ WebSocket ERROR:", error);
  },
});

/**
 * Handle stream start - initialize OpenAI Realtime connection
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleStreamStart(peer: any, data: TwilioStreamMessage) {
  const callSid = data.start?.callSid || data.start?.customParameters?.callSid;
  
  console.log("[Twilio Stream] 🔍 Extracting callSid from start event...");
  console.log("[Twilio Stream] data.start:", JSON.stringify(data.start, null, 2));
  
  if (!callSid) {
    console.error("[Twilio Stream] ❌ No callSid provided in start event");
    return;
  }

  console.log("[Twilio Stream] ✅ Stream started for call:", callSid);

  // Fetch call record to get context
  const driver = postgres(env.DATABASE_URL);
  const db = drizzle({ client: driver, schema, casing: "snake_case" });
  
  try {
    const [call] = await db
      .select()
      .from(calls)
      .where(eq(calls.callSid, callSid))
      .limit(1);

    if (!call) {
      console.warn("[Twilio Stream] ⚠️  Call not found for callSid:", callSid);
      await driver.end();
      return;
    }

    console.log("[Twilio Stream] ✅ Found call record:", call.id);

    // Create OpenAI Realtime client with call context
    const openaiApiKey = env.OPENAI_API_KEY;
    console.log("[Twilio Stream] 🔑 Checking OpenAI API key...");
    console.log("[Twilio Stream] API key present:", !!openaiApiKey);
    console.log("[Twilio Stream] API key length:", openaiApiKey?.length || 0);
    
    if (!openaiApiKey) {
      console.error("[Twilio Stream] ❌ OPENAI_API_KEY not configured");
      await driver.end();
      return;
    }

    const instructions = `You are speaking with ${call.recipientName}. Context: ${call.recipientContext}. 

Have a natural, friendly conversation. Keep responses concise and conversational.`;
    
    console.log("[Twilio Stream] 🤖 Creating OpenAI client with instructions:", instructions);

    const openaiClient = new OpenAIRealtimeClient({
      apiKey: openaiApiKey,
      voice: "alloy",
      instructions,
    });

    // Connect to OpenAI
    console.log("[Twilio Stream] 🔌 Connecting to OpenAI Realtime API...");
    try {
      await openaiClient.connect();
      console.log("[Twilio Stream] ✅ OpenAI connection established");
    } catch (openaiError) {
      console.error("[Twilio Stream] ❌ Failed to connect to OpenAI:", openaiError);
      console.error("[Twilio Stream] OpenAI error stack:", openaiError instanceof Error ? openaiError.stack : openaiError);
      await driver.end();
      return;
    }

    // Store OpenAI client on peer for later use
    peer.openaiClient = openaiClient;
    peer.callSid = callSid;
    peer.streamSid = data.streamSid;

    // Handle audio responses from OpenAI
    openaiClient.onAudio((audioBase64) => {
      console.log("[Twilio Stream] 🔊 Received audio from OpenAI, length:", audioBase64.length);
      
      try {
        // Convert PCM16 24kHz from OpenAI to PCMU 8kHz for Twilio
        const pcmuAudio = pcm16ToPCMU(audioBase64);
        console.log("[Twilio Stream] 🔄 Converted to PCMU, length:", pcmuAudio.length);
        
        // Send to Twilio via Media Stream
        const mediaMessage = {
          event: "media",
          streamSid: peer.streamSid,
          media: {
            payload: pcmuAudio,
          },
        };
        
        peer.send(JSON.stringify(mediaMessage));
        console.log("[Twilio Stream] 📤 Sent audio to Twilio");
      } catch (error) {
        console.error("[Twilio Stream] ❌ Error converting/sending audio:", error);
      }
    });

    // Handle transcripts
    openaiClient.onTranscript((text) => {
      console.log("[Twilio Stream] 📝 Transcript:", text);
      // TODO: Store transcript in database
    });

    // Handle errors
    openaiClient.onError((error) => {
      console.error("[Twilio Stream] ❌ OpenAI error:", error);
    });

    console.log("[Twilio Stream] ✅ OpenAI Realtime connected for call:", callSid);
  } catch (error) {
    console.error("[Twilio Stream] ❌ Error setting up OpenAI:", error);
    console.error("[Twilio Stream] Error stack:", error instanceof Error ? error.stack : error);
  } finally {
    await driver.end();
  }
}

/**
 * Handle audio chunks from Twilio
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleMediaChunk(peer: any, data: TwilioStreamMessage) {
  if (!data.media || data.media.track !== "inbound") {
    return; // Only process caller audio (inbound)
  }

  const openaiClient = peer.openaiClient as OpenAIRealtimeClient | undefined;
  
  if (!openaiClient) {
    console.warn("[Twilio Stream] ⚠️  OpenAI client not initialized yet - skipping audio chunk");
    return;
  }

  try {
    // Convert PCMU 8kHz from Twilio to PCM16 24kHz for OpenAI
    const pcm16Audio = pcmuToPCM16(data.media.payload);
    
    // Log first few chunks for debugging
    if (!peer.audioChunkCount) {
      peer.audioChunkCount = 0;
    }
    peer.audioChunkCount++;
    
    if (peer.audioChunkCount <= 5) {
      console.log(`[Twilio Stream] 🎤 Processing audio chunk #${peer.audioChunkCount}, payload length:`, data.media.payload.length);
      console.log(`[Twilio Stream] 🔄 Converted to PCM16, length:`, pcm16Audio.length);
    }
    
    // Send to OpenAI Realtime API
    openaiClient.sendAudio(pcm16Audio);
    
    if (peer.audioChunkCount === 1) {
      console.log("[Twilio Stream] ✅ First audio chunk sent to OpenAI successfully");
    }
  } catch (error) {
    console.error("[Twilio Stream] ❌ Error processing audio chunk:", error);
    console.error("[Twilio Stream] Error stack:", error instanceof Error ? error.stack : error);
  }
}

/**
 * Handle stream stop - cleanup
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleStreamStop(peer: any, data: TwilioStreamMessage) {
  const callSid = data.stop?.callSid || peer.callSid;
  console.log("[Twilio Stream] 🛑 Stream stopped for call:", callSid);

  // Commit final audio buffer to OpenAI
  const openaiClient = peer.openaiClient as OpenAIRealtimeClient | undefined;
  if (openaiClient) {
    console.log("[Twilio Stream] 📤 Committing final audio to OpenAI...");
    openaiClient.commitAudio();
    
    // Give it a moment to finish processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Close OpenAI connection
    console.log("[Twilio Stream] 🔌 Closing OpenAI connection...");
    openaiClient.close();
  }

  peer.close();
  console.log("[Twilio Stream] ✅ Cleanup complete");
}

