/**
 * Update a call record with payment transaction hash from its credit
 * 
 * Run: bun run scripts/update-call-payment-hash.ts <callId>
 */

import postgres from "postgres";
import { env } from "~/env/server";
import { drizzle } from "drizzle-orm/postgres-js";
import { callCredits } from "~/lib/db/schema/credits";
import { calls } from "~/lib/db/schema/calls";
import { eq } from "drizzle-orm";
import * as schema from "~/lib/db/schema";

async function updateCallPaymentHash(callId: string) {
  console.log(`🔍 Looking up credit for call: ${callId}\n`);

  const driver = postgres(env.DATABASE_URL);
  const db = drizzle({ client: driver, schema, casing: "snake_case" });

  try {
    // Find the credit used for this call
    const [credit] = await db
      .select()
      .from(callCredits)
      .where(eq(callCredits.callId, callId))
      .limit(1);

    if (!credit) {
      console.log("❌ No credit found for this call");
      return;
    }

    console.log("Found credit:");
    console.log(`   ID: ${credit.id}`);
    console.log(`   Payment Method: ${credit.paymentMethod}`);
    console.log(`   Payment Ref: ${credit.paymentRef || "Not set"}`);
    console.log(`   Network: ${credit.network || "Not set"}`);

    if (!credit.paymentRef) {
      console.log("\n⚠️  Credit has no paymentRef - cannot update call");
      return;
    }

    // Update the call with the paymentRef
    await db
      .update(calls)
      .set({ paymentTxHash: credit.paymentRef })
      .where(eq(calls.id, callId));

    console.log(`\n✅ Updated call ${callId} with paymentTxHash: ${credit.paymentRef}`);
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await driver.end();
  }
}

const callId = process.argv[2] || "1ba71a8d-77d1-47c7-a7e1-3c6fc6b3a3cb";

if (import.meta.main) {
  updateCallPaymentHash(callId)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Failed:", error);
      process.exit(1);
    });
}

