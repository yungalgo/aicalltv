import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// Job type from pg-boss (used indirectly through getBoss)
import { env } from "~/env/server";
import { calls } from "~/lib/db/schema/calls";
import * as schema from "~/lib/db/schema";
import { getBoss, JOB_TYPES } from "~/lib/queue/boss";
import {
  incrementDailyCallCount,
  shouldRetryCall,
  calculateNextRetryTime,
} from "~/lib/calls/retry-logic";

interface ProcessCallJob {
  callId: string;
}

export async function setupCallProcessorWorker() {
  const boss = await getBoss();

  // Queue is created in getBoss(), so we can start worker directly
  await boss.work<ProcessCallJob>(
    JOB_TYPES.PROCESS_CALL,
    async ([job]) => {
      if (!job) return;
      
      const { callId } = job.data;

      console.log(`[Call Processor] Processing call ${callId}`);

      // Create database connection
      const driver = postgres(env.DATABASE_URL);
      const db = drizzle({ client: driver, schema, casing: "snake_case" });

      try {
        // Fetch call record
        const [call] = await db
          .select()
          .from(calls)
          .where(eq(calls.id, callId))
          .limit(1);

        if (!call) {
          throw new Error(`Call ${callId} not found`);
        }

        // CRITICAL: Check that OpenAI prompt is ready before processing call
        console.log(`[Call Processor] 🔍 Checking call readiness for ${callId}...`);
        console.log(`[Call Processor]   Status: ${call.status}`);
        console.log(`[Call Processor]   Has OpenAI prompt: ${!!call.openaiPrompt}`);
        
        if (!call.openaiPrompt) {
          console.error(`[Call Processor] ❌ Call ${callId} missing OpenAI prompt! Status: ${call.status}`);
          console.error(`[Call Processor]   Call cannot be processed without prompt. Skipping...`);
          
          // If status is prompt_ready but prompt is missing, something went wrong
          if (call.status === "prompt_ready") {
            console.error(`[Call Processor]   Status says prompt_ready but prompt is missing - data inconsistency!`);
            await db
              .update(calls)
              .set({
                status: "call_failed",
                updatedAt: new Date(),
              })
              .where(eq(calls.id, callId));
            return;
          }
          
          // If status is call_created, prompt generation might have failed - don't process
          if (call.status === "call_created") {
            console.error(`[Call Processor]   Call still in call_created status without prompt - prompt generation may have failed`);
            return;
          }
          
          // For other statuses, log and skip
          return;
        }
        
        // Only process calls that are in "prompt_ready" status
        if (call.status !== "prompt_ready") {
          console.log(`[Call Processor] ⏸️  Call ${callId} not ready yet. Status: ${call.status} (expected: prompt_ready)`);
          return;
        }
        
        console.log(`[Call Processor] ✅ Call ${callId} is ready - has prompt and status is prompt_ready`);

        // Check if we should retry this call now
        const retryCheck = await shouldRetryCall(db, callId);
        if (!retryCheck.shouldRetry) {
          console.log(
            `[Call Processor] Skipping call ${callId}: ${retryCheck.reason}`,
          );

          // If it's just outside calling hours but within the day, schedule for later today
          // Otherwise, calculate next retry time
          const { isWithinCallingHours } = await import("~/lib/calls/retry-logic");
          const canCallNow = isWithinCallingHours(call.encryptedHandle || "");
          
          if (!canCallNow && retryCheck.reason?.includes("calling hours")) {
            // Within the day but outside hours - schedule for next available time slot today
            const now = new Date();
            const { getTimezoneForPhoneNumber } = await import("~/lib/calls/retry-logic");
            const timezone = getTimezoneForPhoneNumber(call.encryptedHandle || "");
            const formatter = new Intl.DateTimeFormat("en-US", {
              timeZone: timezone,
              hour: "numeric",
              hour12: false,
            });
            const parts = formatter.formatToParts(now);
            const currentHour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
            
            // Schedule for next available time slot today (10 AM, 2 PM, or 6 PM)
            const RETRY_TIME_SLOTS = [10, 14, 18];
            const nextSlot = RETRY_TIME_SLOTS.find((slot) => slot > currentHour) || RETRY_TIME_SLOTS[0];
            
            // Calculate next retry time today
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
              .where(eq(calls.id, callId));

            const boss = await getBoss();
            await boss.send(
              JOB_TYPES.PROCESS_CALL,
              { callId },
              { startAfter: nextRetryAt },
            );
          } else {
            // Calculate next retry time (for daily limit or other reasons)
            const nextRetryAt = calculateNextRetryTime(
              call.encryptedHandle || "",
              call.daysSinceFirstAttempt || 0,
            );

            if (nextRetryAt) {
              // Update call with next retry time
              await db
                .update(calls)
                .set({
                  nextRetryAt,
                  updatedAt: new Date(),
                })
                .where(eq(calls.id, callId));

              // Schedule retry job for later
              const boss = await getBoss();
              await boss.send(
                JOB_TYPES.PROCESS_CALL,
                { callId },
                { startAfter: nextRetryAt },
              );
            } else {
              // Max retry days exceeded - mark as failed
              await db
                .update(calls)
                .set({
                  status: "call_failed",
                  updatedAt: new Date(),
                })
                .where(eq(calls.id, callId));
            }
          }

          return; // Exit without processing
        }

        // Increment daily call count (TCPA compliance)
        await incrementDailyCallCount(db, call.encryptedHandle || "");

        // Calculate days since first attempt
        const now = new Date();
        const firstAttemptAt = call.firstAttemptAt || now;
        const daysSinceFirstAttempt = Math.floor(
          (now.getTime() - firstAttemptAt.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Update status to "call_attempted"
        await db
          .update(calls)
          .set({
            status: "call_attempted",
            attempts: call.attempts + 1,
            firstAttemptAt: call.firstAttemptAt || now,
            lastAttemptAt: now,
            daysSinceFirstAttempt,
            updatedAt: new Date(),
          })
          .where(eq(calls.id, callId));

        // TODO: Step 1 - Generate script with OpenAI GPT-4 Turbo
        // const script = await generateScript(call.recipientContext);
        // await db.update(calls).set({ script }).where(eq(calls.id, callId));

        // Step 2 - Initiate Twilio call
        try {
          const { initiateTwilioCall } = await import("~/lib/twilio/call");
          const callResult = await initiateTwilioCall(call);
          
          // Store Twilio Call SID for webhook mapping
          await db
            .update(calls)
            .set({
              callSid: callResult.callSid,
              recordingSid: callResult.recordingSid || null,
              updatedAt: new Date(),
            })
            .where(eq(calls.id, callId));
          
          // Call initiated successfully - status will be updated via webhook when call completes
          // If call fails (no answer, busy, etc.), webhook will handle retry scheduling
          console.log(`[Call Processor] Call initiated for ${callId}, waiting for webhook...`);
          
          // Don't mark as complete here - wait for webhook to handle call completion
          // The webhook will:
          // - Update status to "call_complete" if successful
          // - Schedule next retry if no answer/failed
          // - Enqueue video generation job
          
        } catch (twilioError) {
          console.error(`[Call Processor] Twilio error for call ${callId}:`, twilioError);
          
          // Call failed to initiate - schedule retry at next available slot
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
            .where(eq(calls.id, callId));

          const boss = await getBoss();
          await boss.send(
            JOB_TYPES.PROCESS_CALL,
            { callId },
            { startAfter: nextRetryAt },
          );
        }
      } catch (error) {
        console.error(`[Call Processor] Error processing call ${callId}:`, error);

        // Fetch call to check retry status
        const [call] = await db
          .select()
          .from(calls)
          .where(eq(calls.id, callId))
          .limit(1);

        if (!call) {
          return; // Call not found, exit
        }

        // Check if max retry days exceeded
        if ((call.daysSinceFirstAttempt || 0) >= 5) {
          await db
            .update(calls)
            .set({
              status: "call_failed",
              updatedAt: new Date(),
            })
            .where(eq(calls.id, callId));
          return;
        }

        // Calculate next retry time
        const nextRetryAt = calculateNextRetryTime(
          call.encryptedHandle || "",
          call.daysSinceFirstAttempt || 0,
        );

        if (nextRetryAt) {
          // Schedule retry for later
          await db
            .update(calls)
            .set({
              nextRetryAt,
              updatedAt: new Date(),
            })
            .where(eq(calls.id, callId));

          const boss = await getBoss();
          await boss.send(
            JOB_TYPES.PROCESS_CALL,
            { callId },
            { startAfter: nextRetryAt },
          );
        } else {
          // No more retries - mark as failed
          await db
            .update(calls)
            .set({
              status: "call_failed",
              updatedAt: new Date(),
            })
            .where(eq(calls.id, callId));
        }
      } finally {
        await driver.end();
      }
    },
  );

  console.log(`[Call Processor] Worker started for job type: ${JOB_TYPES.PROCESS_CALL}`);
}

