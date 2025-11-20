/**
 * WebSocket handler for Twilio Media Streams
 * This file uses Nitro's crossws WebSocket support
 * 
 * Path: /api/twilio/_ws/stream (Nitro converts _ws to WebSocket route)
 * 
 * Architecture:
 * Twilio Call → Media Stream (WS) → This Handler → OpenAI Realtime API (WS)
 */

import { defineWebSocketHandler } from "crossws/adapters/nitro";
import { OpenAIRealtimeClient } from "~/lib/realtime/openai-client";
import { pcmuToPCM16, pcm16ToPCMU } from "~/lib/realtime/audio-converter";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { env } from "~/env/server";
import { calls } from "~/lib/db/schema/calls";
import * as schema from "~/lib/db/schema";

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
  async open(peer) {
    console.log("[Twilio Stream] WebSocket connection opened");
    
    // Store connection metadata
    peer.subscribe("twilio-stream");
    
    // Initialize OpenAI Realtime client (will be created on 'start' event)
    peer.publish("twilio-stream", {
      type: "connection-opened",
      peerId: peer.id,
    });
  },

  async message(peer, message) {
    try {
      const data: TwilioStreamMessage = JSON.parse(message.text());

      switch (data.event) {
        case "connected":
          console.log("[Twilio Stream] Stream connected:", data.streamSid);
          break;

        case "start":
          await handleStreamStart(peer, data);
          break;

        case "media":
          await handleMediaChunk(peer, data);
          break;

        case "stop":
          await handleStreamStop(peer, data);
          break;

        default:
          console.log("[Twilio Stream] Unknown event:", data.event);
      }
    } catch (error) {
      console.error("[Twilio Stream] Error processing message:", error);
    }
  },

  async close(peer, details) {
    console.log("[Twilio Stream] Connection closed:", details.code, details.reason);
    
    // Clean up OpenAI connection if exists
    const openaiClient = (peer as any).openaiClient as OpenAIRealtimeClient | undefined;
    if (openaiClient) {
      openaiClient.close();
    }
  },

  async error(peer, error) {
    console.error("[Twilio Stream] WebSocket error:", error);
  },
});

/**
 * Handle stream start - initialize OpenAI Realtime connection
 */
async function handleStreamStart(peer: any, data: TwilioStreamMessage) {
  const callSid = data.start?.callSid || data.start?.customParameters?.callSid;
  
  if (!callSid) {
    console.error("[Twilio Stream] No callSid provided in start event");
    return;
  }

  console.log("[Twilio Stream] Stream started for call:", callSid);

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
      console.warn("[Twilio Stream] Call not found for callSid:", callSid);
      await driver.end();
      return;
    }

    // Create OpenAI Realtime client with call context
    const openaiApiKey = env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("[Twilio Stream] OPENAI_API_KEY not configured");
      await driver.end();
      return;
    }

    const openaiClient = new OpenAIRealtimeClient({
      apiKey: openaiApiKey,
      voice: "alloy",
      instructions: `You are speaking with ${call.recipientName}. Context: ${call.recipientContext}. 
      
Have a natural, friendly conversation. Keep responses concise and conversational.`,
    });

    // Connect to OpenAI
    await openaiClient.connect();

    // Store OpenAI client on peer for later use
    peer.openaiClient = openaiClient;
    peer.callSid = callSid;
    peer.streamSid = data.streamSid;

    // Handle audio responses from OpenAI
    openaiClient.onAudio((audioBase64) => {
      // Convert PCM16 24kHz from OpenAI to PCMU 8kHz for Twilio
      const pcmuAudio = pcm16ToPCMU(audioBase64);
      
      // Send to Twilio via Media Stream
      peer.send(JSON.stringify({
        event: "media",
        streamSid: peer.streamSid,
        media: {
          payload: pcmuAudio,
        },
      }));
    });

    // Handle transcripts
    openaiClient.onTranscript((text) => {
      console.log("[Twilio Stream] Transcript:", text);
      // TODO: Store transcript in database
    });

    // Handle errors
    openaiClient.onError((error) => {
      console.error("[Twilio Stream] OpenAI error:", error);
    });

    console.log("[Twilio Stream] OpenAI Realtime connected for call:", callSid);
  } catch (error) {
    console.error("[Twilio Stream] Error setting up OpenAI:", error);
  } finally {
    await driver.end();
  }
}

/**
 * Handle audio chunks from Twilio
 */
async function handleMediaChunk(peer: any, data: TwilioStreamMessage) {
  if (!data.media || data.media.track !== "inbound") {
    return; // Only process caller audio (inbound)
  }

  const openaiClient = peer.openaiClient as OpenAIRealtimeClient | undefined;
  
  if (!openaiClient) {
    console.warn("[Twilio Stream] OpenAI client not initialized yet");
    return;
  }

  try {
    // Convert PCMU 8kHz from Twilio to PCM16 24kHz for OpenAI
    const pcm16Audio = pcmuToPCM16(data.media.payload);
    
    // Send to OpenAI Realtime API
    openaiClient.sendAudio(pcm16Audio);
  } catch (error) {
    console.error("[Twilio Stream] Error processing audio chunk:", error);
  }
}

/**
 * Handle stream stop - cleanup
 */
async function handleStreamStop(peer: any, data: TwilioStreamMessage) {
  const callSid = data.stop?.callSid || peer.callSid;
  console.log("[Twilio Stream] Stream stopped for call:", callSid);

  // Commit final audio buffer to OpenAI
  const openaiClient = peer.openaiClient as OpenAIRealtimeClient | undefined;
  if (openaiClient) {
    openaiClient.commitAudio();
    
    // Give it a moment to finish processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Close OpenAI connection
    openaiClient.close();
  }

  peer.close();
}

