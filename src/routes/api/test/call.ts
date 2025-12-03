import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "~/env/server";
import { calls } from "~/lib/db/schema/calls";
import * as schema from "~/lib/db/schema";
import { auth } from "~/lib/auth/auth";
import { getRequest } from "@tanstack/react-start/server";
import { initiateTwilioCall } from "~/lib/twilio/call";

/**
 * Test endpoint to initiate a Twilio call
 * POST /api/test/call
 * Body: { phoneNumber: string, recipientName: string }
 * 
 * This is useful for testing calls without going through the full UI flow
 */
export const Route = createFileRoute("/api/test/call")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Get authenticated user
        const session = await auth.api.getSession({
          headers: getRequest().headers,
        });

        if (!session?.user) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const userId = session.user.id;

        try {
          const body = await request.json();
          const { phoneNumber, recipientName } = body;

          if (!phoneNumber || !recipientName) {
            return new Response(
              JSON.stringify({
                error: "Missing required fields: phoneNumber, recipientName",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          // Validate phone number format (basic check)
          if (!phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
            return new Response(
              JSON.stringify({ error: "Invalid phone number format. Use E.164 format (e.g., +1234567890)" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          // Create database connection
          const driver = postgres(env.DATABASE_URL);
          const db = drizzle({ client: driver, schema, casing: "snake_case" });

          // Create call record
          const encryptedHandle = `encrypted_${phoneNumber}`;
          const [newCall] = await db
            .insert(calls)
            .values({
              userId,
              recipientName,
              targetGender: "prefer_not_to_say",
              videoStyle: "anime",
              encryptedHandle,
              paymentMethod: "free", // Test calls are free
              isFree: true,
              status: "call_created",
            })
            .returning();

          // Initiate the call
          const callResult = await initiateTwilioCall(newCall);

          // Update call with Twilio Call SID
          await db
            .update(calls)
            .set({
              callSid: callResult.callSid,
              updatedAt: new Date(),
            })
            .where(eq(calls.id, newCall.id));

          await driver.end();

          return new Response(
            JSON.stringify({
              success: true,
              callId: newCall.id,
              callSid: callResult.callSid,
              message: `Call initiated to ${phoneNumber}. Check Twilio console for status.`,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (error) {
          console.error("[Test Call] Error:", error);
          return new Response(
            JSON.stringify({
              error: "Failed to initiate call",
              details: error instanceof Error ? error.message : "Unknown error",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
    },
  },
});

