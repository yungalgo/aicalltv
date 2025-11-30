import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { env } from "~/env/server";
import { callCredits } from "~/lib/db/schema/credits";
import * as schema from "~/lib/db/schema";

// Price in cents - must match checkout.ts
const PRICE_CENTS = 9; // TODO: Change back to 900 for production ($9.00 per call)

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events (checkout.session.completed)
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

            // Get user ID from metadata
            const userId = session.metadata?.userId;
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

            // Create the credit
            const [credit] = await db
              .insert(callCredits)
              .values({
                userId,
                state: "unused",
                paymentMethod: "stripe",
                paymentRef: session.id,
                network: "stripe",
                amountCents: PRICE_CENTS,
              })
              .returning();

            console.log(`[Stripe Webhook] ✅ Created credit ${credit.id} for user ${userId} (session: ${session.id})`);
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

