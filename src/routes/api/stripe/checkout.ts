import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { env } from "~/env/server";
import { auth } from "~/lib/auth/auth";
import { PAYMENT_CONFIG } from "~/lib/web3/config";

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session and returns the URL
 * Accepts call form data in body to pass to webhook
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

          // Parse form data from request body
          const body = await request.json().catch(() => ({}));
          const callData = body.callData || {};

          // Validate required fields
          if (!callData.callerId) {
            return new Response(
              JSON.stringify({ error: "Caller selection is required" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          if (!callData.recipientName || !callData.phoneNumber) {
            return new Response(
              JSON.stringify({ error: "Recipient name and phone number are required" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const stripe = new Stripe(env.STRIPE_SECRET_KEY);

          // Get base URL for redirects
          const baseUrl = env.VITE_BASE_URL || "http://localhost:3000";

          // Create Checkout Session with form data in metadata
          // Stripe metadata values must be strings and max 500 chars each
          const checkoutSession = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: [
              {
                price_data: {
                  currency: "usd",
                  product_data: {
                    name: "AI Call Credit",
                    description: `AI call to ${callData.recipientName || "recipient"}`,
                  },
                  unit_amount: PAYMENT_CONFIG.priceCents,
                },
                quantity: 1,
              },
            ],
            // Store user ID and call data in metadata for webhook
            metadata: {
              userId: session.user.id,
              // Call data (truncated to fit Stripe's 500 char limit per field)
              recipientName: String(callData.recipientName || "").slice(0, 500),
              phoneNumber: String(callData.phoneNumber || "").slice(0, 500),
              callerId: String(callData.callerId || "").slice(0, 500), // Selected caller
              targetGender: String(callData.targetGender || "male").slice(0, 500),
              targetGenderCustom: String(callData.targetGenderCustom || "").slice(0, 500),
              targetAgeRange: String(callData.targetAgeRange || "").slice(0, 500),
              // New personalization fields
              targetCity: String(callData.targetCity || "").slice(0, 500),
              targetHobby: String(callData.targetHobby || "").slice(0, 500),
              targetProfession: String(callData.targetProfession || "").slice(0, 500),
              interestingPiece: String(callData.interestingPiece || "").slice(0, 500),
              ragebaitTrigger: String(callData.ragebaitTrigger || "").slice(0, 500),
              videoStyle: String(callData.videoStyle || "anime").slice(0, 500),
              // Optional uploaded image
              uploadedImageUrl: String(callData.uploadedImageUrl || "").slice(0, 500),
              uploadedImageS3Key: String(callData.uploadedImageS3Key || "").slice(0, 500),
              // Fhenix FHE encryption data
              fhenixEnabled: String(callData.fhenixEnabled || false),
              fhenixVaultId: String(callData.fhenixVaultId || "").slice(0, 500),
            },
            // Redirect URLs - go back to home page where the calls table is
            success_url: `${baseUrl}/?payment=success`,
            cancel_url: `${baseUrl}/?payment=cancelled`,
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

