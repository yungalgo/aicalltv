import { createServerFn } from "@tanstack/react-start";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import { env } from "~/env/server";
import { calls } from "~/lib/db/schema/calls";
import * as schema from "~/lib/db/schema";
import { auth } from "~/lib/auth/auth";
import { getRequest } from "@tanstack/react-start/server";

const createCallSchema = z.object({
  recipientName: z.string().min(1, "Recipient name is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  recipientContext: z
    .string()
    .min(1, "Context is required")
    .max(1000, "Context must be 1000 characters or less"),
  paymentMethod: z.enum([
    "free",
    "web3_wallet",
    "near_ai",
    "sol",
    "mina",
    "zcash",
  ]),
  isFree: z.boolean(),
  paymentTxHash: z.string().optional(),
  paymentAmount: z.string().optional(),
});

export type CreateCallInput = z.infer<typeof createCallSchema>;

export const createCall = createServerFn({ method: "POST" }).handler(
  async ({ data: input }: { data: unknown }) => {
    // Validate input with Zod (following TanStack Start pattern)
    const data = createCallSchema.parse(input);
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: getRequest().headers,
    });

    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const userId = session.user.id;

    // Create database connection
    const driver = postgres(env.DATABASE_URL);
    const db = drizzle({ client: driver, schema, casing: "snake_case" });

    // TODO: Encrypt phone number with Fhenix CoFHE
    // For now, we'll store it as plain text (will encrypt later)
    const encryptedHandle = `encrypted_${data.phoneNumber}`;

    // TODO: Check free credits if paymentMethod is "free"
    // If free: Check user.freeCallCredits > 0, decrement if available
    // If paid: Payment already processed (via webhook or dummy flow)

    // Create call record - This submits the call for processing
    // Status: call_created → Will be processed by workers (pg-boss)
    const [newCall] = await db
      .insert(calls)
      .values({
        userId,
        recipientName: data.recipientName,
        recipientContext: data.recipientContext,
        encryptedHandle,
        paymentMethod: data.paymentMethod,
        isFree: data.isFree,
        paymentTxHash: data.paymentTxHash || null,
        paymentAmount: data.paymentAmount || null,
        status: "call_created",
      })
      .returning();

    // Close database connection
    await driver.end();

    return {
      success: true,
      callId: newCall.id,
      call: newCall,
    };
  },
);

