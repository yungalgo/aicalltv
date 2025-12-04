import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { drizzle } from "drizzle-orm/postgres-js";
import { createPostgresDriver } from "~/lib/db";
import { eq } from "drizzle-orm";
import { env } from "~/env/server";
import { callCredits } from "~/lib/db/schema/credits";
import { calls } from "~/lib/db/schema/calls";
import * as schema from "~/lib/db/schema";
import { PAYMENT_CONFIG } from "~/lib/web3/config";

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events (checkout.session.completed)
 * Creates credit AND call from metadata in one go
 */
export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let driver: ReturnType<typeof createPostgresDriver> | null = null;

        try {
          // Check Stripe is configured
          if (!env.STRIPE_SECRET_KEY) {
            console.error("[Stripe Webhook] STRIPE_SECRET_KEY not configured");
            return new Response("Webhook Error: Stripe not configured", { status: 500 });
          }

          const stripe = new Stripe(env.STRIPE_SECRET_KEY);

          // Get the raw body for signature verification
          const body = await request.text();
          const signature = request.headers.get("stripe-signature");

          let event: Stripe.Event;

          // Verify webhook signature if secret is configured
          if (env.STRIPE_WEBHOOK_SECRET && signature) {
            try {
              event = stripe.webhooks.constructEvent(
                body,
                signature,
                env.STRIPE_WEBHOOK_SECRET
              );
            } catch (err) {
              console.error("[Stripe Webhook] Signature verification failed:", err);
              return new Response("Webhook signature verification failed", { status: 400 });
            }
          } else {
            // For development without webhook secret, parse directly
            // WARNING: This is insecure for production!
            console.warn("[Stripe Webhook] ⚠️ No webhook secret configured - skipping signature verification");
            event = JSON.parse(body) as Stripe.Event;
          }

          console.log(`[Stripe Webhook] Received event: ${event.type}`);

          // Handle the checkout.session.completed event
          if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            const metadata = session.metadata || {};

            // Get user ID from metadata
            const userId = metadata.userId;
            if (!userId) {
              console.error("[Stripe Webhook] No userId in session metadata");
              return new Response("Missing userId in metadata", { status: 400 });
            }

            // Check if this session was already processed (idempotency)
            driver = createPostgresDriver();
            const db = drizzle({ client: driver, schema, casing: "snake_case" });

            const [existingCredit] = await db
              .select()
              .from(callCredits)
              .where(eq(callCredits.paymentRef, session.id))
              .limit(1);

            if (existingCredit) {
              console.log(`[Stripe Webhook] Session ${session.id} already processed, skipping`);
              return new Response("Already processed", { status: 200 });
            }

            // Extract call data from metadata
            const recipientName = metadata.recipientName || "";
            const phoneNumber = metadata.phoneNumber || "";
            // callerId might be empty string, so check for that too
            const callerIdRaw = metadata.callerId || "";
            const callerId = callerIdRaw.trim() || null; // Selected caller (null if empty)
            const targetGender = (metadata.targetGender || "male") as "male" | "female" | "prefer_not_to_say" | "other";
            const targetGenderCustom = metadata.targetGenderCustom || null;
            const targetAgeRange = metadata.targetAgeRange || null;
            const targetCity = metadata.targetCity || null;
            const targetHobby = metadata.targetHobby || null;
            const targetProfession = metadata.targetProfession || null;
            const interestingPiece = metadata.interestingPiece || null;
            const ragebaitTrigger = metadata.ragebaitTrigger || null;
            const videoStyle = metadata.videoStyle || "anime";
            const uploadedImageUrl = metadata.uploadedImageUrl || null;
            const uploadedImageS3Key = metadata.uploadedImageS3Key || null;
            // Fhenix FHE encryption data
            const fhenixEnabled = metadata.fhenixEnabled === "true";
            const fhenixVaultId = metadata.fhenixVaultId || null;
            
            // Log metadata for debugging
            console.log(`[Stripe Webhook] Metadata received:`, {
              recipientName,
              phoneNumber,
              callerIdRaw,
              callerId,
              targetGender,
              videoStyle,
              hasCallerId: !!callerId,
              targetCity,
              targetHobby,
              targetProfession,
            });

            // Validate required fields
            if (!recipientName || !phoneNumber) {
              console.error("[Stripe Webhook] Missing required call data in metadata");
              // Still create credit so user can manually create call
              const [credit] = await db
                .insert(callCredits)
                .values({
                  userId,
                  state: "unused",
                  paymentMethod: "credit_card",
                  paymentRef: session.id,
                  network: "credit_card",
                  amountCents: PAYMENT_CONFIG.priceCents,
                })
                .returning();
              console.log(`[Stripe Webhook] ✅ Created credit ${credit.id} (no call data)`);
              return new Response("OK - Credit created, no call data", { status: 200 });
            }

            // Fetch caller data if callerId is provided
            let callerData: { name: string; personality: string; speakingStyle: string; appearanceDescription?: string } | undefined;
            if (callerId) {
              const { eq } = await import("drizzle-orm");
              const [caller] = await db
                .select({
                  name: schema.callers.name,
                  personality: schema.callers.personality,
                  speakingStyle: schema.callers.speakingStyle,
                  appearanceDescription: schema.callers.appearanceDescription,
                })
                .from(schema.callers)
                .where(eq(schema.callers.id, callerId))
                .limit(1);
              
              if (caller) {
                callerData = {
                  name: caller.name,
                  personality: caller.personality,
                  speakingStyle: caller.speakingStyle,
                  appearanceDescription: caller.appearanceDescription,
                };
                console.log(`[Stripe Webhook] 📞 Using caller: ${caller.name}`);
              } else {
                console.warn(`[Stripe Webhook] ⚠️ Caller ${callerId} not found, proceeding without caller personality`);
              }
            } else {
              console.warn(`[Stripe Webhook] ⚠️ No callerId provided in metadata`);
            }

            // Generate OpenAI prompt and welcome greeting using the same function as createCall
            console.log(`[Stripe Webhook] 🕐 Generating OpenAI prompt...`);
            let openaiPrompt: string;
            let welcomeGreeting: string;
            try {
              const { generateCallPrompts } = await import("~/lib/prompts/groq-generator");
              const prompts = await generateCallPrompts({
                targetPerson: {
                  name: recipientName,
                  gender: targetGender,
                  genderCustom: targetGenderCustom || undefined,
                  ageRange: targetAgeRange || undefined,
                  physicalDescription: undefined, // Not in metadata, will be generated from image if provided
                  city: targetCity || undefined,
                  hobby: targetHobby || undefined,
                  profession: targetProfession || undefined,
                  interestingPiece: interestingPiece || undefined,
                  ragebaitTrigger: ragebaitTrigger || undefined,
                },
                videoStyle,
                hasUploadedImage: !!(uploadedImageUrl || uploadedImageS3Key),
                caller: callerData,
              });
              openaiPrompt = prompts.systemPrompt;
              welcomeGreeting = prompts.welcomeGreeting || "";
              console.log(`[Stripe Webhook] ✅ Generated OpenAI prompt and welcome greeting`);
              console.log(`[Stripe Webhook]    System prompt length: ${openaiPrompt.length}`);
              console.log(`[Stripe Webhook]    Welcome greeting length: ${welcomeGreeting.length}`);
              console.log(`[Stripe Webhook]    Welcome greeting: "${welcomeGreeting.substring(0, 100)}${welcomeGreeting.length > 100 ? '...' : ''}"`);
              console.log(`[Stripe Webhook]    Full prompts object keys:`, Object.keys(prompts));
              if (!welcomeGreeting || welcomeGreeting.trim().length === 0) {
                console.error(`[Stripe Webhook] ❌ ERROR: welcomeGreeting is empty or missing!`);
                console.error(`[Stripe Webhook]    prompts object:`, JSON.stringify(prompts, null, 2));
              }
            } catch (error) {
              console.error(`[Stripe Webhook] ❌ Failed to generate prompt:`, error);
              // Create credit only - user can retry
              const [credit] = await db
                .insert(callCredits)
                .values({
                  userId,
                  state: "unused",
                  paymentMethod: "credit_card",
                  paymentRef: session.id,
                  network: "credit_card",
                  amountCents: PAYMENT_CONFIG.priceCents,
                })
                .returning();
              console.log(`[Stripe Webhook] ✅ Created credit ${credit.id} (prompt failed)`);
              return new Response("OK - Credit created, prompt failed", { status: 200 });
            }

            // Create the call with all fields (matching createCall function)
            let encryptedHandle: string;
            if (fhenixEnabled && fhenixVaultId) {
              encryptedHandle = `fhenix:${fhenixVaultId}`;
              console.log(`[Stripe Webhook] 🔐 Using Fhenix FHE encryption, vaultId: ${fhenixVaultId}`);
            } else {
              encryptedHandle = `encrypted_${phoneNumber}`;
              console.log(`[Stripe Webhook] Using legacy phone encryption`);
            }
            
            const [newCall] = await db
              .insert(calls)
              .values({
                userId,
                callerId: callerId || null, // Selected caller
                recipientName,
                targetGender,
                targetGenderCustom,
                targetAgeRange,
                targetCity,
                targetHobby,
                targetProfession,
                interestingPiece,
                ragebaitTrigger,
                videoStyle,
                uploadedImageUrl,
                uploadedImageS3Key,
                openaiPrompt,
                welcomeGreeting: welcomeGreeting && welcomeGreeting.trim().length > 0 ? welcomeGreeting.trim() : null,
                encryptedHandle,
                paymentMethod: "credit_card",
                isFree: false,
                status: "prompt_ready",
                // Fhenix FHE encryption
                fhenixEnabled,
                fhenixVaultId,
              })
              .returning();

            console.log(`[Stripe Webhook] ✅ Created call ${newCall.id}`);
            console.log(`[Stripe Webhook]    Caller ID: ${newCall.callerId || 'null'}`);
            console.log(`[Stripe Webhook]    Welcome greeting variable before save: "${welcomeGreeting ? welcomeGreeting.substring(0, 50) : 'undefined/null'}"`);
            console.log(`[Stripe Webhook]    Welcome greeting saved to DB: ${newCall.welcomeGreeting ? `"${newCall.welcomeGreeting.substring(0, 50)}..."` : 'null/empty'}`);
            if (!newCall.welcomeGreeting && welcomeGreeting) {
              console.error(`[Stripe Webhook] ❌ CRITICAL: welcomeGreeting was generated but NOT saved to database!`);
              console.error(`[Stripe Webhook]    Generated value: "${welcomeGreeting}"`);
            }

            // Create credit and mark it as consumed
            const [credit] = await db
              .insert(callCredits)
              .values({
                userId,
                state: "consumed",
                paymentMethod: "credit_card",
                paymentRef: session.id,
                network: "credit_card",
                amountCents: PAYMENT_CONFIG.priceCents,
                callId: newCall.id,
                consumedAt: new Date(),
              })
              .returning();

            console.log(`[Stripe Webhook] ✅ Created & consumed credit ${credit.id} for call ${newCall.id}`);

            // Enqueue call for processing
            try {
              const { getBoss, JOB_TYPES } = await import("~/lib/queue/boss");
              const boss = await getBoss();
              await boss.send(JOB_TYPES.PROCESS_CALL, { callId: newCall.id });
              console.log(`[Stripe Webhook] ✅ Enqueued call ${newCall.id} for processing`);
            } catch (queueError) {
              console.error(`[Stripe Webhook] ❌ Failed to enqueue call:`, queueError);
              // Call was created, just not queued - will need manual intervention
            }
          }

          return new Response("OK", { status: 200 });
        } catch (error) {
          console.error("[Stripe Webhook] Error:", error);
          return new Response("Webhook Error", { status: 500 });
        } finally {
          if (driver) {
            await driver.end();
          }
        }
      },
    },
  },
});

