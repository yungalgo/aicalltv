import { createFileRoute } from "@tanstack/react-router";
import { env } from "~/env/server";

/**
 * TwiML endpoint for handling incoming calls
 * Returns TwiML that starts a Media Stream to receive audio
 */
export const Route = createFileRoute("/api/twilio/voice")({
  server: {
    handlers: {
      GET: async () => {
    // WebSocket URL for receiving Media Stream
    const streamUrl = `${env.VITE_BASE_URL.replace("http", "ws")}/api/twilio/stream`;

    // TwiML response that starts the Media Stream
    // Note: Dual-channel recording is enabled in the call creation (call.ts)
    // This TwiML handles the Media Stream for real-time audio processing
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Start>
        <Stream url="${streamUrl}">
            <Parameter name="callSid" value="{{CallSid}}" />
        </Stream>
    </Start>
    <Say voice="alice">Connecting you now.</Say>
    <Pause length="300"/>
    <!-- 
      Note: Dual-channel recording (stereo: left=caller, right=callee) 
      is configured in the call creation API, not in TwiML.
      The recording will be available via the recording-status webhook.
    -->
</Response>`;

    return new Response(twiml, {
      headers: {
        "Content-Type": "text/xml",
      },
    });
      },
    },
  },
});

