/**
 * Migration script to remove the `anything_else` column from the calls table
 * 
 * Run with: bun scripts/remove-anything-else-column.ts
 *       or: npx tsx scripts/remove-anything-else-column.ts
 * 
 * NOTE: This assumes the database is empty (no records).
 * If there are records, they will be lost when dropping the column.
 */

import postgres from "postgres";
import { env } from "~/env/server";

async function removeAnythingElseColumn() {
  console.log("🔄 Removing `anything_else` column from calls table...\n");
  const driver = postgres(env.DATABASE_URL);

  try {
    // Check if column exists
    const columnCheck = await driver.unsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'calls' 
      AND column_name = 'anything_else';
    `);

    if (columnCheck.length === 0) {
      console.log("✅ Column `anything_else` does not exist - nothing to remove");
      return;
    }

    console.log("⚠️  Column `anything_else` found - dropping it...");

    // Drop the column
    await driver.unsafe(`
      ALTER TABLE calls
      DROP COLUMN IF EXISTS anything_else;
    `);

    console.log("✅ Column `anything_else` removed successfully!");

    // Verify removal
    const verifyCheck = await driver.unsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'calls' 
      AND column_name = 'anything_else';
    `);

    if (verifyCheck.length === 0) {
      console.log("✅ Verification: Column successfully removed");
    } else {
      console.log("❌ Verification failed: Column still exists");
      throw new Error("Column removal verification failed");
    }

  } catch (error) {
    console.error("❌ Error removing column:", error);
    throw error;
  } finally {
    await driver.end();
  }
}

if (import.meta.main) {
  removeAnythingElseColumn()
    .then(() => {
      console.log("\n✨ Migration complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Failed:", error);
      process.exit(1);
    });
}

