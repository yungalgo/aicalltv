import { createFileRoute } from "@tanstack/react-router";
import { env } from "~/env/server";

/**
 * TwiML endpoint for Twilio voice calls
 * Returns TwiML that starts a Media Stream for bidirectional audio
 */
export const Route = createFileRoute("/api/twilio/voice")({
  server: {
    handlers: {
      POST: async () => {
        const streamUrl = env.WEBSOCKET_URL || "ws://localhost:3001/twilio/stream";

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${streamUrl}">
            <Parameter name="callSid" value="{{CallSid}}" />
        </Stream>
    </Connect>
</Response>`;

        return new Response(twiml, {
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});
