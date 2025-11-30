import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { env } from "~/env/server";
import { auth } from "~/lib/auth/auth";

// Price in cents - imported from shared config
// We can't import PAYMENT_CONFIG directly (it uses import.meta.env for client)
// So we define the price here and keep it in sync
const PRICE_CENTS = 50; // TODO: Change back to 900 for production ($9.00 per call) - Stripe minimum is $0.50

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session and returns the URL
 */
export const Route = createFileRoute("/api/stripe/checkout")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // Verify user is authenticated
          const session = await auth.api.getSession({
            headers: request.headers,
          });

          if (!session?.user) {
            return new Response(
              JSON.stringify({ error: "Unauthorized - Please sign in" }),
              { status: 401, headers: { "Content-Type": "application/json" } }
            );
          }

          // Check Stripe is configured
          if (!env.STRIPE_SECRET_KEY) {
            console.error("[Stripe] STRIPE_SECRET_KEY not configured");
            return new Response(
              JSON.stringify({ error: "Payment system not configured" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          const stripe = new Stripe(env.STRIPE_SECRET_KEY);

          // Get base URL for redirects
          const baseUrl = env.VITE_BASE_URL || "http://localhost:3000";

          // Create Checkout Session
          const checkoutSession = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: [
              {
                price_data: {
                  currency: "usd",
                  product_data: {
                    name: "AI Call Credit",
                    description: "1 AI-powered phone call",
                  },
                  unit_amount: PRICE_CENTS, // Amount in cents
                },
                quantity: 1,
              },
            ],
            // Store user ID in metadata for webhook
            metadata: {
              userId: session.user.id,
            },
            // Redirect URLs
            success_url: `${baseUrl}/dashboard?payment=success`,
            cancel_url: `${baseUrl}/dashboard?payment=cancelled`,
          });

          console.log(`[Stripe] Created checkout session ${checkoutSession.id} for user ${session.user.id}`);

          return new Response(
            JSON.stringify({ 
              checkoutUrl: checkoutSession.url,
              sessionId: checkoutSession.id,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (error) {
          console.error("[Stripe] Error creating checkout session:", error);
          return new Response(
            JSON.stringify({ error: "Failed to create checkout session" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});

