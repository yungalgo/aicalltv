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
    // Nitro handles _ws routes as WebSocket endpoints
    const streamUrl = `${env.VITE_BASE_URL.replace("http", "ws")}/api/twilio/_ws/stream`;

    // TwiML response that starts the Media Stream and connects to OpenAI Realtime
    // OpenAI will handle the conversation - no need for <Say> here
    // Dual-channel recording is enabled in the call creation (call.ts)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Start>
        <Stream url="${streamUrl}">
            <Parameter name="callSid" value="{{CallSid}}" />
        </Stream>
    </Start>
    <Pause length="300"/>
    <!-- 
      Note: OpenAI Realtime API handles the conversation via Media Stream.
      Dual-channel recording (stereo: left=caller, right=callee) 
      is configured in the call creation API for post-call processing.
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

