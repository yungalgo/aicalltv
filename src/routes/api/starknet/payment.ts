/**
 * Ztarknet Payment API
 * 
 * Handles privacy-preserving payment verification on Ztarknet.
 * Flow:
 * 1. POST /api/starknet/payment - Create payment order with ZK proof data
 * 2. GET /api/starknet/payment?action=verify&orderId=X - Verify proof on-chain
 */

import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth/auth";
import { PAYMENT_CONFIG } from "~/lib/web3/config";

// In-memory store for pending Starknet payments (use Redis in production)
const pendingPayments = new Map<string, {
  orderId: string;
  userId: string;
  paymentHash: string;
  createdAt: number;
  formData: Record<string, unknown>;
  status: "pending" | "proof_submitted" | "verified" | "failed";
  transactionHash?: string;
}>();

// Verifier contract address on Ztarknet (Starknet Sepolia fork)
// TODO: Update after deploying your verifier contract
const VERIFIER_CONTRACT = "0x02048def58e122c910f80619ebab076b0ef5513550d38afdfdf2d8a1710fa7c6";

export const Route = createFileRoute("/api/starknet/payment")({
  server: {
    handlers: {
      // GET: Check payment status or verify proof
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get("action");
        const orderId = url.searchParams.get("orderId");

        // Get verifier contract info
        if (action === "config") {
          return new Response(JSON.stringify({
            verifierContract: VERIFIER_CONTRACT,
            network: "ztarknet",
            chainId: "0x534e5f5345504f4c4941", // SN_SEPOLIA
          }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        // Check payment status
        if (action === "status" && orderId) {
          const pending = pendingPayments.get(orderId);
          if (!pending) {
            return new Response(
              JSON.stringify({ error: "Order not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            );
          }

          return new Response(JSON.stringify({
            orderId: pending.orderId,
            status: pending.status,
            transactionHash: pending.transactionHash,
          }), { headers: { "Content-Type": "application/json" } });
        }

        // Verify proof submission
        if (action === "verify" && orderId) {
          const pending = pendingPayments.get(orderId);
          if (!pending) {
            return new Response(
              JSON.stringify({ error: "Order not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            );
          }

          // If we have a transaction hash, verify it on-chain
          if (pending.transactionHash) {
            // In production, you would call the Starknet RPC to verify the tx
            // For hackathon demo, we trust the client-submitted tx hash
            pending.status = "verified";
            
            return new Response(JSON.stringify({
              status: "verified",
              orderId,
              transactionHash: pending.transactionHash,
            }), { headers: { "Content-Type": "application/json" } });
          }

          return new Response(JSON.stringify({
            status: pending.status,
            orderId,
          }), { headers: { "Content-Type": "application/json" } });
        }

        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      },

      // POST: Create payment order or submit proof
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
          const { action, orderId, transactionHash, formData } = body;

          // Submit proof transaction hash
          if (action === "submit_proof" && orderId && transactionHash) {
            const pending = pendingPayments.get(orderId);
            if (!pending) {
              return new Response(
                JSON.stringify({ error: "Order not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
              );
            }

            // Verify the order belongs to this user
            if (pending.userId !== session.user.id) {
              return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 403, headers: { "Content-Type": "application/json" } }
              );
            }

            // Update with transaction hash
            pending.transactionHash = transactionHash;
            pending.status = "proof_submitted";

            return new Response(JSON.stringify({
              success: true,
              orderId,
              status: "proof_submitted",
            }), { headers: { "Content-Type": "application/json" } });
          }

          // Create new payment order
          if (!formData) {
            return new Response(
              JSON.stringify({ error: "Missing form data" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // Generate unique order ID
          const newOrderId = `STRK-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          
          // Generate payment hash (in production, this would be a cryptographic commitment)
          // For hackathon, we use a simple hash of orderId + timestamp
          const paymentHash = `0x${Buffer.from(newOrderId).toString('hex').slice(0, 62)}`;

          // Store pending payment
          pendingPayments.set(newOrderId, {
            orderId: newOrderId,
            userId: session.user.id,
            paymentHash,
            createdAt: Date.now(),
            formData,
            status: "pending",
          });

          // Clean up old pending payments (older than 1 hour)
          const oneHourAgo = Date.now() - 3600000;
          for (const [key, value] of pendingPayments.entries()) {
            if (value.createdAt < oneHourAgo) {
              pendingPayments.delete(key);
            }
          }

          // Calculate amount in USD
          const usdAmount = PAYMENT_CONFIG.priceUSD;

          return new Response(JSON.stringify({
            orderId: newOrderId,
            paymentHash,
            amount: usdAmount,
            verifierContract: VERIFIER_CONTRACT,
            // Public inputs for the ZK proof
            publicInputs: {
              paymentHash,
              orderId: newOrderId,
            },
          }), { headers: { "Content-Type": "application/json" } });
        } catch (error) {
          console.error("[Starknet] Error:", error);
          return new Response(
            JSON.stringify({ error: "Failed to process payment" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});

