import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "~/env/server";
import { calls } from "~/lib/db/schema/calls";
import { user } from "~/lib/db/schema/auth.schema";
import * as schema from "~/lib/db/schema";
import { initiateTwilioCall } from "~/lib/twilio/call";

/**
 * Simple test endpoint to initiate a Twilio call WITHOUT authentication
 * POST /api/test/call-simple
 * Body: { phoneNumber: string, recipientName: string }
 * 
 * WARNING: This endpoint does NOT require authentication - use only for testing!
 * It uses the first user in the database or creates a test user.
 */
export const Route = createFileRoute("/api/test/call-simple")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
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

          // Get or create a test user
          let testUserId: string;
          const [existingUser] = await db
            .select()
            .from(user)
            .limit(1);

          if (existingUser) {
            testUserId = existingUser.id;
          } else {
            // Create a test user if none exists
            const testUserEmail = `test-${Date.now()}@example.com`;
            const [newUser] = await db
              .insert(user)
              .values({
                id: `test-user-${Date.now()}`,
                name: "Test User",
                email: testUserEmail,
                emailVerified: false,
              })
              .returning();
            testUserId = newUser.id;
          }

          // Create call record
          const encryptedHandle = `encrypted_${phoneNumber}`;
          const [newCall] = await db
            .insert(calls)
            .values({
              userId: testUserId,
              recipientName,
              targetGender: "prefer_not_to_say",
              videoStyle: "anime",
              encryptedHandle,
              paymentMethod: "free",
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
              phoneNumber,
              recipientName,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (error) {
          console.error("[Test Call Simple] Error:", error);
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

