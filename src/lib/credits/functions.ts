import { createServerFn } from "@tanstack/react-start";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { env } from "~/env/server";
import { callCredits } from "~/lib/db/schema/credits";
import * as schema from "~/lib/db/schema";
import { auth } from "~/lib/auth/auth";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Create a credit after payment confirmation
 * Called by frontend after crypto tx confirms, or by webhook for Lemon Squeezy
 */
const createCreditSchema = z.object({
  paymentMethod: z.enum(["free", "sol_usdc", "base_usdc", "zcash", "ztarknet", "credit_card"]),
  paymentRef: z.string().optional(), // tx hash, Stripe session ID, etc.
  network: z.string().optional(), // "base", "solana", "credit_card", "zcash", "ztarknet"
  amountCents: z.number().int().positive(), // e.g., 900 = $9.00
});

export type CreateCreditInput = z.infer<typeof createCreditSchema>;

export const createCredit = createServerFn({ method: "POST" }).handler(
  async ({ data: input }: { data: unknown }) => {
    try {
      const data = createCreditSchema.parse(input);

      // Get authenticated user
      const session = await auth.api.getSession({
        headers: getRequest().headers,
      });

      if (!session?.user) {
        throw new Error("Unauthorized - Please sign in");
      }

      const userId = session.user.id;

      // Create database connection
      const driver = postgres(env.DATABASE_URL);
      const db = drizzle({ client: driver, schema, casing: "snake_case" });

      try {
        // Check if this paymentRef was already used (prevent replay attacks)
        if (data.paymentRef) {
          const [existing] = await db
            .select()
            .from(callCredits)
            .where(eq(callCredits.paymentRef, data.paymentRef))
            .limit(1);

          if (existing) {
            console.log(`[Credit] ⚠️ Duplicate paymentRef: ${data.paymentRef}`);
            throw new Error("Payment already recorded");
          }
        }

        // Create credit with state="unused"
        const [credit] = await db
          .insert(callCredits)
          .values({
            userId,
            state: "unused",
            paymentMethod: data.paymentMethod,
            paymentRef: data.paymentRef || null,
            network: data.network || null,
            amountCents: data.amountCents,
          })
          .returning();

        console.log(`[Credit] ✅ Created credit ${credit.id} for user ${userId} (${data.paymentMethod})`);

        return { creditId: credit.id };
      } finally {
        await driver.end();
      }
    } catch (error) {
      console.error("[Credit] Error creating credit:", error);
      throw error;
    }
  }
);

/**
 * Get user's credit balance (unused credits count)
 */
export const getCreditBalance = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const session = await auth.api.getSession({
        headers: getRequest().headers,
      });

      if (!session?.user) {
        return { balance: 0 };
      }

      const driver = postgres(env.DATABASE_URL);
      const db = drizzle({ client: driver, schema, casing: "snake_case" });

      try {
        const credits = await db
          .select()
          .from(callCredits)
          .where(
            and(
              eq(callCredits.userId, session.user.id),
              eq(callCredits.state, "unused")
            )
          );

        return { balance: credits.length };
      } finally {
        await driver.end();
      }
    } catch (error) {
      console.error("[Credit] Error getting balance:", error);
      return { balance: 0 };
    }
  }
);

/**
 * Consume a credit for a call (internal use - called by createCall)
 * Returns credit info if successful, throws if no credit available
 */
export async function consumeCredit(
  db: ReturnType<typeof drizzle>,
  userId: string,
  callId: string
): Promise<{
  creditId: string;
  paymentMethod: string;
  isFree: boolean;
}> {
  // Find an unused credit for this user (oldest first)
  const [credit] = await db
    .select()
    .from(callCredits)
    .where(
      and(
        eq(callCredits.userId, userId),
        eq(callCredits.state, "unused")
      )
    )
    .orderBy(callCredits.createdAt) // FIFO - use oldest credit first
    .limit(1);

  if (!credit) {
    throw new Error("No unused credits available. Please purchase a call first.");
  }

  // Mark as consumed
  await db
    .update(callCredits)
    .set({
      state: "consumed",
      callId,
      consumedAt: new Date(),
    })
    .where(eq(callCredits.id, credit.id));

  console.log(`[Credit] ✅ Consumed credit ${credit.id} for call ${callId} (method: ${credit.paymentMethod})`);

  return {
    creditId: credit.id,
    paymentMethod: credit.paymentMethod,
    isFree: credit.paymentMethod === "free",
  };
}

