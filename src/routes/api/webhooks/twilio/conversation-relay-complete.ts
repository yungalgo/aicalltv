import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook for ConversationRelay session completion
 * Called when the <Connect> verb ends (session ended, failed, or completed)
 */
export const Route = createFileRoute("/api/webhooks/twilio/conversation-relay-complete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const formData = await request.formData();
        
        const callSid = formData.get("CallSid") as string;
        const sessionId = formData.get("SessionId") as string;
        const sessionStatus = formData.get("SessionStatus") as string;
        const sessionDuration = formData.get("SessionDuration") as string;
        const callStatus = formData.get("CallStatus") as string;
        const errorCode = formData.get("ErrorCode") as string | null;
        const errorMessage = formData.get("ErrorMessage") as string | null;
        const handoffData = formData.get("HandoffData") as string | null;

        console.log("=".repeat(60));
        console.log("[ConversationRelay Complete] Session ended");
        console.log(`  Call SID: ${callSid}`);
        console.log(`  Session ID: ${sessionId}`);
        console.log(`  Session Status: ${sessionStatus}`);
        console.log(`  Session Duration: ${sessionDuration}s`);
        console.log(`  Call Status: ${callStatus}`);
        
        if (errorCode) {
          console.log(`  ❌ Error Code: ${errorCode}`);
          console.log(`  ❌ Error Message: ${errorMessage}`);
        }
        
        if (handoffData) {
          console.log(`  📤 Handoff Data: ${handoffData}`);
        }
        
        console.log("=".repeat(60));

        // TODO: Update call record in database with session info
        // TODO: Trigger video generation if needed

        // Return TwiML to continue the call flow (or just hang up)
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Thank you for calling. Goodbye!</Say>
    <Hangup/>
</Response>`;

        return new Response(twiml, {
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});

