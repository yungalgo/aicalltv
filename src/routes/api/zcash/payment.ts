/**
 * ZCash Payment API
 * 
 * Endpoints for generating payment requests and checking payment status.
 * Communicates with the zcash-service running on Railway.
 */

import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth/auth";
import { env } from "~/env/server";
import { PAYMENT_CONFIG } from "~/lib/web3/config";

// ZCash service URL (set in Railway env)
const ZCASH_SERVICE_URL = env.ZCASH_SERVICE_URL || "http://localhost:8080";

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
          if (!pending) {
            return new Response(
              JSON.stringify({ error: "Order not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            );
          }

          try {
            // Check with zcash service
            const response = await fetch(
              `${ZCASH_SERVICE_URL}/check-payment?memo=${encodeURIComponent(pending.memo)}`
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

          // Get address from zcash service
          const addressResponse = await fetch(`${ZCASH_SERVICE_URL}/address`);
          if (!addressResponse.ok) {
            throw new Error("Failed to get ZCash address");
          }
          let addresses = await addressResponse.json();
          console.log("[ZCash] Raw addresses response type:", typeof addresses);
          
          // zingo-cli outputs log messages along with JSON - need to extract the JSON
          if (typeof addresses === 'string') {
            // Try to find JSON array or object in the string
            const jsonMatch = addresses.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                addresses = JSON.parse(jsonMatch[0]);
                console.log("[ZCash] Extracted JSON from string:", JSON.stringify(addresses));
              } catch {
                console.log("[ZCash] Failed to parse extracted JSON");
              }
            }
          }
          
          // Extract address from various zingo-cli output formats
          let address: string | undefined;
          
          if (typeof addresses === 'string') {
            // Simple string address (shouldn't happen after above parsing)
            address = addresses;
          } else if (Array.isArray(addresses)) {
            // Array format: [{encoded_address: "u1...", ...}, ...] or ["u1...", ...]
            const first = addresses[0];
            if (typeof first === 'string') {
              address = first;
            } else if (first && typeof first === 'object') {
              // zingo-cli returns {encoded_address: "...", ...}
              address = first.encoded_address || first.address || first.ua || first.z_address;
            }
          } else if (typeof addresses === 'object') {
            // Object format: {encoded_address: "u1...", z_address: "zs...", ua: "u1..."}
            address = addresses.encoded_address || addresses.ua || addresses.unified_address || addresses.z_address || addresses.address;
          }
          
          console.log("[ZCash] Extracted address:", address);
          
          if (!address || typeof address !== 'string') {
            console.error("[ZCash] Could not extract valid address from:", addresses);
            throw new Error("No valid ZCash address available");
          }

          // Calculate ZEC amount (using CoinGecko or hardcoded for hackathon)
          // For hackathon: 1 ZEC ≈ $50, so $0.50 = 0.01 ZEC
          const usdAmount = PAYMENT_CONFIG.priceUSD;
          const zecPrice = 50; // Approximate ZEC price in USD
          const zecAmount = (usdAmount / zecPrice).toFixed(4);

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

