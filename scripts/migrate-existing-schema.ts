/**
 * Migration script for existing database
 * Adds missing columns and removes deprecated ones
 * 
 * Run with: bun scripts/migrate-existing-schema.ts
 */

import postgres from "postgres";
import { env } from "~/env/server";

async function migrateSchema() {
  console.log("🔄 Migrating existing database schema...\n");
  const driver = postgres(env.DATABASE_URL);

  try {
    // Check if anything_else column exists
    const columnCheck = await driver.unsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'calls' 
      AND column_name = 'anything_else';
    `);

    if (columnCheck.length > 0) {
      console.log("⚠️  Found deprecated column `anything_else` - removing...");
      await driver.unsafe(`
        ALTER TABLE calls
        DROP COLUMN IF EXISTS anything_else;
      `);
      console.log("✅ Removed `anything_else` column");
    } else {
      console.log("✅ Column `anything_else` does not exist");
    }

    // Add missing columns if they don't exist
    const columnsToAdd = [
      { name: "target_city", type: "TEXT" },
      { name: "target_hobby", type: "TEXT" },
      { name: "target_profession", type: "TEXT" },
      { name: "ragebait_trigger", type: "TEXT" },
      { name: "uploaded_image_url", type: "TEXT" },
      { name: "uploaded_image_s3_key", type: "TEXT" },
      { name: "video_s3_key", type: "TEXT" },
      { name: "fhenix_enabled", type: "BOOLEAN NOT NULL DEFAULT false" },
      { name: "fhenix_vault_id", type: "TEXT" },
    ];

    console.log("\n📋 Checking for missing columns...");
    for (const col of columnsToAdd) {
      const exists = await driver.unsafe(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'calls' 
        AND column_name = '${col.name}';
      `);

      if (exists.length === 0) {
        console.log(`  ➕ Adding column: ${col.name}`);
        await driver.unsafe(`
          ALTER TABLE calls
          ADD COLUMN ${col.name} ${col.type};
        `);
        console.log(`  ✅ Added ${col.name}`);
      } else {
        console.log(`  ✅ Column ${col.name} already exists`);
      }
    }

    console.log("\n✅ Migration complete!");
    console.log("   Run 'bun scripts/check-db.ts' to verify");

  } catch (error) {
    console.error("❌ Error migrating schema:", error);
    throw error;
  } finally {
    await driver.end();
  }
}

if (import.meta.main) {
  migrateSchema()
    .then(() => {
      console.log("\n✨ All done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Failed:", error);
      process.exit(1);
    });
}

