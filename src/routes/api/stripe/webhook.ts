import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
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
        let driver: ReturnType<typeof postgres> | null = null;

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
            driver = postgres(env.DATABASE_URL);
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
            const targetGender = (metadata.targetGender || "male") as "male" | "female" | "prefer_not_to_say" | "other";
            const targetGenderCustom = metadata.targetGenderCustom || null;
            const targetAgeRange = metadata.targetAgeRange || null;
            const interestingPiece = metadata.interestingPiece || null;
            const videoStyle = metadata.videoStyle || "anime";
            const anythingElse = metadata.anythingElse || null;
            // Fhenix FHE encryption data
            const fhenixEnabled = metadata.fhenixEnabled === "true";
            const fhenixVaultId = metadata.fhenixVaultId || null;

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
                  network: "stripe",
                  amountCents: PAYMENT_CONFIG.priceCents,
                })
                .returning();
              console.log(`[Stripe Webhook] ✅ Created credit ${credit.id} (no call data)`);
              return new Response("OK - Credit created, no call data", { status: 200 });
            }

            // Generate OpenAI prompt
            console.log(`[Stripe Webhook] 🕐 Generating OpenAI prompt...`);
            let openaiPrompt: string;
            try {
              const { generateOpenAIPrompt } = await import("~/lib/prompts/groq-generator");
              openaiPrompt = await generateOpenAIPrompt({
                targetPerson: {
                  name: recipientName,
                  gender: targetGender,
                  genderCustom: targetGenderCustom || undefined,
                  ageRange: targetAgeRange || undefined,
                  interestingPiece: interestingPiece || undefined,
                },
                videoStyle,
                anythingElse: anythingElse || undefined,
              });
              console.log(`[Stripe Webhook] ✅ Generated OpenAI prompt`);
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
                  network: "stripe",
                  amountCents: PAYMENT_CONFIG.priceCents,
                })
                .returning();
              console.log(`[Stripe Webhook] ✅ Created credit ${credit.id} (prompt failed)`);
              return new Response("OK - Credit created, prompt failed", { status: 200 });
            }

            // Create the call
            const encryptedHandle = `encrypted_${phoneNumber}`;
            const [newCall] = await db
              .insert(calls)
              .values({
                userId,
                recipientName,
                anythingElse,
                targetGender,
                targetGenderCustom,
                targetAgeRange,
                interestingPiece,
                videoStyle,
                openaiPrompt,
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

            // Create credit and mark it as consumed
            const [credit] = await db
              .insert(callCredits)
              .values({
                userId,
                state: "consumed",
                paymentMethod: "credit_card",
                paymentRef: session.id,
                network: "stripe",
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

