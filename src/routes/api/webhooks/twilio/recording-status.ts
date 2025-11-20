import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "~/env/server";
import { calls } from "~/lib/db/schema/calls";
import * as schema from "~/lib/db/schema";

/**
 * Webhook endpoint for Twilio recording status updates
 * Receives POST requests when recording is ready
 */
export const Route = createFileRoute("/api/webhooks/twilio/recording-status")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
    const formData = await request.formData();
    
    const recordingSid = formData.get("RecordingSid") as string;
    const recordingUrl = formData.get("RecordingUrl") as string;
    const callSid = formData.get("CallSid") as string;
    const recordingStatus = formData.get("RecordingStatus") as string;

    console.log(`[Twilio Webhook] Recording ${recordingSid} status: ${recordingStatus}`);

    // Create database connection
    const driver = postgres(env.DATABASE_URL);
    const db = drizzle({ client: driver, schema, casing: "snake_case" });

    try {
      if (recordingStatus === "completed" && recordingUrl) {
        // Find call by Twilio Call SID
        const [call] = await db
          .select()
          .from(calls)
          .where(eq(calls.callSid, callSid))
          .limit(1);

        if (call) {
          // Update call with recording URL
          await db
            .update(calls)
            .set({
              recordingUrl,
              recordingSid,
              updatedAt: new Date(),
            })
            .where(eq(calls.id, call.id));

          console.log(`[Twilio Webhook] Recording ready for call ${call.id}: ${recordingUrl}`);
        }
      }
    } catch (error) {
      console.error("[Twilio Webhook] Error processing recording status:", error);
    } finally {
      await driver.end();
    }

    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: {
        "Content-Type": "text/xml",
      },
    });
      },
    },
  },
});

