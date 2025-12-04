import { createFileRoute } from "@tanstack/react-router";
import { env } from "~/env/server";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { calls } from "~/lib/db/schema/calls";
import * as schema from "~/lib/db/schema";

/**
 * TwiML endpoint for Twilio ConversationRelay
 * Uses ElevenLabs TTS + Deepgram STT for high-quality voice interactions
 * 
 * ConversationRelay handles:
 * - Speech-to-text (STT) via Deepgram
 * - Text-to-speech (TTS) via ElevenLabs
 * - Interruption detection with utteranceUntilInterrupt
 * - Session management
 */
export const Route = createFileRoute("/api/twilio/voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Parse form data to get call info
        const formData = await request.formData();
        const callSid = formData.get("CallSid") as string;
        
        // Get call ID from URL query params
        const url = new URL(request.url);
        const callId = url.searchParams.get("callId");
        
        console.log("[Voice] TwiML requested");
        console.log(`[Voice]   CallSid: ${callSid}`);
        console.log(`[Voice]   CallId: ${callId}`);

        // Default welcome greeting and voice ID
        let welcomeGreeting = "Hello! How can I help you today?";
        let voiceId = "UgBBYS2sOqTuMpoF3BR0"; // Default ElevenLabs voice
        
        // Fetch call-specific welcome greeting and caller voice ID from database
        if (callId) {
          try {
            const driver = postgres(env.DATABASE_URL);
            const db = drizzle({ client: driver, schema, casing: "snake_case" });
            
            const [call] = await db
              .select({ 
                welcomeGreeting: calls.welcomeGreeting,
                callerId: calls.callerId,
              })
              .from(calls)
              .where(eq(calls.id, callId))
              .limit(1);
            
            if (call?.welcomeGreeting) {
              welcomeGreeting = call.welcomeGreeting;
              console.log(`[Voice] ✅ Using greeting: "${welcomeGreeting.substring(0, 50)}..."`);
            }
            
            // Fetch caller's voice ID if caller is selected
            if (call?.callerId) {
              const [caller] = await db
                .select({ voiceId: schema.callers.voiceId })
                .from(schema.callers)
                .where(eq(schema.callers.id, call.callerId))
                .limit(1);
              
              if (caller?.voiceId) {
                voiceId = caller.voiceId;
                console.log(`[Voice] ✅ Using caller voice ID: ${voiceId}`);
              }
            }
            
            await driver.end();
          } catch (error) {
            console.error("[Voice] Failed to fetch call data:", error);
          }
        }
        
        // Escape XML special characters in greeting
        const escapedGreeting = welcomeGreeting
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");
        
        // WebSocket URL for ConversationRelay
        const wsUrl = env.WEBSOCKET_URL || "wss://localhost:3001/ws";
        
        console.log(`[Voice] WebSocket URL: ${wsUrl}`);

        // TwiML with ConversationRelay
        // Using ElevenLabs for TTS (best quality voices)
        // Using Deepgram for STT (best accuracy)
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect action="${env.VITE_BASE_URL}/api/webhooks/twilio/conversation-relay-complete">
        <ConversationRelay 
            url="${wsUrl}"
            welcomeGreeting="${escapedGreeting}"
            welcomeGreetingInterruptible="speech"
            ttsProvider="ElevenLabs"
            voice="${voiceId}"
            transcriptionProvider="Deepgram"
            speechModel="nova-3-general"
            interruptible="speech"
            interruptSensitivity="low"
            dtmfDetection="true"
        >
            <Parameter name="callSid" value="${callSid}" />
        </ConversationRelay>
    </Connect>
</Response>`;

        return new Response(twiml, {
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});

