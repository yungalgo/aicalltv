import { createFileRoute } from "@tanstack/react-router";
import { env } from "~/env/server";

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
export const Route = createFileRoute("/api/twilio/voice-relay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Parse form data to get call info
        const formData = await request.formData();
        const callSid = formData.get("CallSid") as string;
        
        // WebSocket URL for ConversationRelay
        const wsUrl = env.WEBSOCKET_URL 
          ? env.WEBSOCKET_URL.replace("/twilio/stream", "/conversation-relay")
          : "wss://localhost:3001/conversation-relay";
        
        console.log("[ConversationRelay] TwiML requested for call:", callSid);
        console.log("[ConversationRelay] WebSocket URL:", wsUrl);

        // TwiML with ConversationRelay
        // Using ElevenLabs for TTS (default, best quality)
        // Using Deepgram for STT (default, best accuracy)
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect action="${env.VITE_BASE_URL}/api/webhooks/twilio/conversation-relay-complete">
        <ConversationRelay 
            url="${wsUrl}"
            welcomeGreeting="Hello, this is Barry from the International Cheese Council. Am I speaking with the primary cheese license holder at this residence?"
            welcomeGreetingInterruptible="speech"
            ttsProvider="ElevenLabs"
            voice="UgBBYS2sOqTuMpoF3BR0"
            transcriptionProvider="Deepgram"
            speechModel="nova-3-general"
            interruptible="speech"
            interruptSensitivity="low"
            dtmfDetection="true"
            debug="debugging speaker-events"
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

