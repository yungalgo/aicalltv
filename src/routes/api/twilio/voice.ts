import { createFileRoute } from "@tanstack/react-router";
import { env } from "~/env/server";

/**
 * TwiML endpoint for handling incoming calls
 * Returns TwiML that starts a Media Stream to receive audio
 */
export const Route = createFileRoute("/api/twilio/voice")({
  server: {
    handlers: {
      POST: async () => {
    // WebSocket URL for receiving Media Stream
    // Nitro WebSocket handlers go in server/routes/
    const streamUrl = `${env.VITE_BASE_URL.replace("http", "ws")}/twilio/stream`;

    // TwiML response for bidirectional Media Stream
    // Per Twilio docs: Use <Connect><Stream> for bidirectional streams (not <Start><Stream>)
    // This blocks execution until WebSocket disconnects or call ends
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${streamUrl}">
            <Parameter name="callSid" value="{{CallSid}}" />
        </Stream>
    </Connect>
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

