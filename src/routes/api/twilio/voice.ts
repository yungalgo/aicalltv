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
    console.log("=".repeat(80));
    console.log("[TwiML Voice] 📞 Twilio requested TwiML for call");
    console.log("[TwiML Voice] VITE_BASE_URL:", env.VITE_BASE_URL);
    
    // WebSocket URL for receiving Media Stream
    // WebSocket server runs on port 3001 with its own ngrok tunnel
    const streamUrl = env.WEBSOCKET_URL || "ws://localhost:3001/twilio/stream";
    console.log("[TwiML Voice] 🔌 Stream URL:", streamUrl);

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

    console.log("[TwiML Voice] 📤 Returning TwiML:");
    console.log(twiml);
    console.log("=".repeat(80));

    return new Response(twiml, {
      headers: {
        "Content-Type": "text/xml",
      },
    });
      },
    },
  },
});

