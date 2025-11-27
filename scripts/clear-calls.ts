/**
 * Clear all calls from the database
 * Usage: bun run scripts/clear-calls.ts
 */

import postgres from "postgres";
import { env } from "~/env/server";

async function clearCalls() {
  console.log("🔄 Connecting to database...");
  const driver = postgres(env.DATABASE_URL);

  try {
    // Delete from call_analytics first (foreign key)
    const analyticsResult = await driver`DELETE FROM call_analytics`;
    console.log(`🗑️  Deleted ${analyticsResult.count} call analytics records`);
    
    // Delete all calls
    const callsResult = await driver`DELETE FROM calls`;
    console.log(`🗑️  Deleted ${callsResult.count} calls`);
    
    // Also clear pg-boss jobs related to calls
    try {
      await driver`DELETE FROM pgboss.job WHERE name IN ('process-call', 'generate-video')`;
      console.log(`🗑️  Cleared pg-boss job queue`);
    } catch {
      console.log(`ℹ️  pg-boss tables not found (that's okay)`);
    }

    console.log("✅ All calls cleared!");
  } catch (error) {
    console.error("❌ Error clearing calls:", error);
    throw error;
  } finally {
    await driver.end();
  }
}

clearCalls()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

