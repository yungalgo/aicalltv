import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "~/env/server";
import { calls } from "~/lib/db/schema/calls";
import * as schema from "~/lib/db/schema";
import { getBoss, JOB_TYPES } from "~/lib/queue/boss";

/**
 * Webhook endpoint for Twilio call status updates
 * Receives POST requests when call status changes
 */
export const Route = createFileRoute("/api/webhooks/twilio/call-status")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
    let driver: ReturnType<typeof postgres> | null = null;
    
    try {
    const formData = await request.formData();
    
    // Twilio sends form-encoded data
    const callSid = formData.get("CallSid") as string;
    const callStatus = formData.get("CallStatus") as string;
    const duration = formData.get("CallDuration") as string;

      if (!callSid) {
        console.warn("[Twilio Webhook] Missing CallSid in request");
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
          headers: { "Content-Type": "text/xml" },
        });
      }

    console.log(`[Twilio Webhook] Call ${callSid} status: ${callStatus}`);

    // Create database connection
      driver = postgres(env.DATABASE_URL);
    const db = drizzle({ client: driver, schema, casing: "snake_case" });

    try {
      // Find call by Twilio Call SID (we'll need to store this)
      // For now, we'll search by encryptedHandle or use a mapping table
      // TODO: Add callSid field to calls table or create mapping
      
      // Find call by Twilio Call SID
      const [call] = await db
        .select()
        .from(calls)
        .where(eq(calls.callSid, callSid))
        .limit(1);

      if (!call) {
        console.warn(`[Twilio Webhook] Call not found for callSid: ${callSid}`);
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
          headers: { "Content-Type": "text/xml" },
        });
      }

      // Update call status based on Twilio status
      if (callStatus === "completed") {
        // Call completed successfully
        await db
          .update(calls)
          .set({
            status: "call_complete",
            duration: duration ? parseInt(duration, 10) : null,
            updatedAt: new Date(),
          })
          .where(eq(calls.id, call.id));

        // Note: Video generation will be enqueued when recording is ready
        // (from recording-status webhook, not here)
        // The recording URL comes from the recording-status webhook
      } else if (callStatus === "no-answer" || callStatus === "busy" || callStatus === "failed") {
        // Call didn't connect - schedule retry at next available slot
        const { getTimezoneForPhoneNumber } = await import("~/lib/calls/retry-logic");
        const timezone = getTimezoneForPhoneNumber(call.encryptedHandle || "");
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          hour: "numeric",
          hour12: false,
        });
        const parts = formatter.formatToParts(now);
        const currentHour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
        
        // Schedule for next available time slot (10 AM, 2 PM, or 6 PM)
        const RETRY_TIME_SLOTS = [10, 14, 18];
        const nextSlot = RETRY_TIME_SLOTS.find((slot) => slot > currentHour) || RETRY_TIME_SLOTS[0];
        
        const nextRetryAt = new Date(now);
        if (nextSlot <= currentHour) {
          nextRetryAt.setDate(nextRetryAt.getDate() + 1);
        }
        nextRetryAt.setHours(nextSlot, 0, 0, 0);
        
        await db
          .update(calls)
          .set({
            nextRetryAt,
            updatedAt: new Date(),
          })
          .where(eq(calls.id, call.id));

        const boss = await getBoss();
        await boss.send(
          JOB_TYPES.PROCESS_CALL,
          { callId: call.id },
          { startAfter: nextRetryAt },
        );
        
        console.log(`[Twilio Webhook] Call ${callSid} failed (${callStatus}), scheduled retry for ${nextRetryAt}`);
      }
      } catch (dbError) {
        console.error("[Twilio Webhook] Error processing call status:", dbError);
        // Continue to return success response to Twilio
    } finally {
        if (driver) {
      await driver.end();
        }
    }

    // Return TwiML response (empty, just acknowledge)
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: {
        "Content-Type": "text/xml",
      },
    });
    } catch (error) {
      console.error("[Twilio Webhook] Fatal error:", error);
      // Always return a valid response to Twilio, even on error
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: {
          "Content-Type": "text/xml",
        },
        status: 200, // Return 200 to prevent Twilio retries
      });
    }
      },
    },
  },
});

