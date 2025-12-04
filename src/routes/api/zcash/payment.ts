/**
 * ZCash Payment API
 * 
 * Generates payment requests with QR codes and verifies payments
 * via the zcash-service (which monitors transactions with a viewing key).
 */

import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth/auth";
import { env } from "~/env/server";
import { PAYMENT_CONFIG } from "~/lib/web3/config";

// zcash-service URL for payment verification
const ZCASH_SERVICE_URL = env.ZCASH_SERVICE_URL || "http://localhost:8080";

// YWallet receiving address (funds go here)
const RECEIVING_ADDRESS = "u1smm22fj85e68exdv77vnxds8agpd2kq0fc0lj2aft0mkkjzffe55t8acyzntq8yqr5dun47drcf0kgusyekdvuy0f0cpcyp357ny6v7jla3cde0hzmjzgy8m72k2p6uk680vxde4cryqv02t3h0he0jn2js43czswsnypuzedq5d3tynevg9paa95pzscw4nxxh2s9wtkdvhk3h7ey4";

// Payment amount in ZEC ($5.00 / $350 per ZEC = 0.014 ZEC)
const ZEC_AMOUNT = PAYMENT_CONFIG.priceZEC;

// Pending payments (in production, use Redis or database)
const pendingPayments = new Map<string, {
  memo: string;
  userId: string;
  createdAt: number;
  formData: Record<string, unknown>;
}>();

export const Route = createFileRoute("/api/zcash/payment")({
  server: {
    handlers: {
      /**
       * GET: Check payment status
       * ?action=check&orderId=ZEC-xxx
       */
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get("action");
        const orderId = url.searchParams.get("orderId");

        if (action === "check" && orderId) {
          // Reconstruct memo from orderId (handles server restarts)
          const memo = `AICALLTV:${orderId}`;
          console.log("[ZCash] Checking payment for:", memo);

          try {
            const response = await fetch(
              `${ZCASH_SERVICE_URL}/check-payment?memo=${encodeURIComponent(memo)}`
            );
            
            if (!response.ok) {
              throw new Error(`zcash-service error: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.found) {
              return Response.json({
                status: "confirmed",
                payment: result.payment,
                orderId,
              });
            }
            
            return Response.json({ status: "pending", orderId });
          } catch (error) {
            console.error("[ZCash] Check error:", error);
            return Response.json(
              { error: "Payment check failed" },
              { status: 500 }
            );
          }
        }

        return Response.json({ error: "Invalid request" }, { status: 400 });
      },

      /**
       * POST: Create new payment request
       * Returns QR code data (ZIP-321 URI)
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          // Require authentication
          const session = await auth.api.getSession({
            headers: request.headers,
          });
          
          if (!session?.user?.id) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const { formData } = await request.json();

          // Generate unique order ID
          const orderId = `ZEC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          
          // Memo identifies this payment (included in shielded transaction)
          const memo = `AICALLTV:${orderId}`;

          // Store pending payment
          pendingPayments.set(orderId, {
            memo,
            userId: session.user.id,
            createdAt: Date.now(),
            formData,
          });

          // Clean up old payments (>1 hour)
          const oneHourAgo = Date.now() - 3600000;
          for (const [key, value] of pendingPayments) {
            if (value.createdAt < oneHourAgo) {
              pendingPayments.delete(key);
            }
          }

          // Build ZIP-321 URI for QR code
          // Memo must be base64url encoded per spec
          const memoBytes = new TextEncoder().encode(memo);
          const base64Memo = btoa(String.fromCharCode(...memoBytes))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
          
          const uri = `zcash:${RECEIVING_ADDRESS}?amount=${ZEC_AMOUNT}&memo=${base64Memo}`;

          console.log("[ZCash] Created payment:", orderId);

          return Response.json({
            orderId,
            address: RECEIVING_ADDRESS,
            amount: ZEC_AMOUNT,
            memo,
            uri,
          });
        } catch (error) {
          console.error("[ZCash] Create error:", error);
          return Response.json(
            { error: "Failed to create payment" },
            { status: 500 }
          );
        }
      },
    },
  },
});
