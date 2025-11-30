/**
 * ZCash Payment API
 * 
 * Endpoints for generating payment requests and checking payment status.
 * Communicates with the zcash-service running on Railway.
 */

import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth/auth";
import { env } from "~/env/server";

// ZCash service URL (set in Railway env) - only used for payment verification
const ZCASH_SERVICE_URL = env.ZCASH_SERVICE_URL || "http://localhost:8080";

// Fixed YWallet receiving address - payments go directly here
const ZCASH_RECEIVING_ADDRESS = "u1t9jazuuepq6asej3danuvnewgvqvtgpmg3686m4825gkknttm3d94sla8t9daa70tgr35u7w5xp2m90gglu4qtt7nyzjznk873vgrpcsl33wz2amau3p96g5vjmlxtezhc06jhqqyth3ghdd45n9x4ekeqkszz3hv2mez52v452krsne";

// In-memory store for pending payments (use Redis in production)
const pendingPayments = new Map<string, {
  orderId: string;
  userId: string;
  amount: number;
  memo: string;
  createdAt: number;
  formData: Record<string, unknown>;
}>();

export const Route = createFileRoute("/api/zcash/payment")({
  server: {
    handlers: {
      // GET: Check payment status or get address
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get("action");
        const orderId = url.searchParams.get("orderId");

        // Get wallet address
        if (action === "address") {
          try {
            const response = await fetch(`${ZCASH_SERVICE_URL}/address`);
            if (!response.ok) {
              throw new Error("Failed to get ZCash address");
            }
            const addresses = await response.json();
            return new Response(JSON.stringify(addresses), {
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            console.error("[ZCash] Error getting address:", error);
            return new Response(
              JSON.stringify({ error: "Failed to get ZCash address" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }
        }

        // Check payment status
        if (action === "check" && orderId) {
          const pending = pendingPayments.get(orderId);
          
          // Reconstruct memo even if not in map (handles server restarts)
          const memo = pending?.memo || `AICALLTV:${orderId}`;
          console.log("[ZCash] Checking payment for memo:", memo);

          try {
            // Check with zcash service
            const response = await fetch(
              `${ZCASH_SERVICE_URL}/check-payment?memo=${encodeURIComponent(memo)}`
            );
            
            if (!response.ok) {
              throw new Error("Failed to check payment");
            }
            
            const result = await response.json();
            
            if (result.found) {
              return new Response(JSON.stringify({
                status: "confirmed",
                payment: result.payment,
                orderId,
              }), { headers: { "Content-Type": "application/json" } });
            } else {
              return new Response(JSON.stringify({
                status: "pending",
                orderId,
              }), { headers: { "Content-Type": "application/json" } });
            }
          } catch (error) {
            console.error("[ZCash] Error checking payment:", error);
            return new Response(
              JSON.stringify({ error: "Failed to check payment" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }
        }

        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      },

      // POST: Create a new payment request
      POST: async ({ request }: { request: Request }) => {
        try {
          // Verify user is authenticated
          const session = await auth.api.getSession({
            headers: request.headers,
          });
          
          if (!session?.user?.id) {
            return new Response(
              JSON.stringify({ error: "Unauthorized" }),
              { status: 401, headers: { "Content-Type": "application/json" } }
            );
          }

          const body = await request.json();
          const { formData } = body;

          // Generate unique order ID
          const orderId = `ZEC-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          
          // Create memo that includes order ID (truncated to fit ZCash memo limit)
          const memo = `AICALLTV:${orderId}`;

          // Use fixed YWallet receiving address
          const address = ZCASH_RECEIVING_ADDRESS;
          console.log("[ZCash] Using fixed receiving address:", address.slice(0, 20) + "...");

          // Hardcoded ZEC amount for hackathon demo (10x cheaper)
          // 0.001 ZEC ≈ $0.05 at current prices
          const zecAmount = "0.0010";

          // Store pending payment
          pendingPayments.set(orderId, {
            orderId,
            userId: session.user.id,
            amount: parseFloat(zecAmount),
            memo,
            createdAt: Date.now(),
            formData,
          });

          // Clean up old pending payments (older than 1 hour)
          const oneHourAgo = Date.now() - 3600000;
          for (const [key, value] of pendingPayments.entries()) {
            if (value.createdAt < oneHourAgo) {
              pendingPayments.delete(key);
            }
          }

          // Return payment details for QR code
          // ZIP-321: memo must be base64url-encoded (not URL-encoded)
          // Convert memo string to bytes, then base64url encode
          const memoBytes = new TextEncoder().encode(memo);
          const base64Memo = btoa(String.fromCharCode(...memoBytes))
            .replace(/\+/g, '-')  // base64url uses - instead of +
            .replace(/\//g, '_')  // base64url uses _ instead of /
            .replace(/=+$/, '');  // remove padding
          
          return new Response(JSON.stringify({
            orderId,
            address,
            amount: zecAmount,
            memo,
            // ZCash URI format (ZIP-321) for wallet scanning
            uri: `zcash:${address}?amount=${zecAmount}&memo=${base64Memo}`,
          }), { headers: { "Content-Type": "application/json" } });
        } catch (error) {
          console.error("[ZCash] Error creating payment:", error);
          return new Response(
            JSON.stringify({ error: "Failed to create payment request" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});

