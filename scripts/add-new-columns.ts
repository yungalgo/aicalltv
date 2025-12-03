/**
 * Add new columns to calls table for form improvements
 */

import postgres from "postgres";
import { env } from "~/env/server";

async function addNewColumns() {
  console.log("🔄 Adding new columns to calls table...");
  const driver = postgres(env.DATABASE_URL);

  try {
    await driver.unsafe(`
      ALTER TABLE calls ADD COLUMN IF NOT EXISTS target_city TEXT;
      ALTER TABLE calls ADD COLUMN IF NOT EXISTS target_hobby TEXT;
      ALTER TABLE calls ADD COLUMN IF NOT EXISTS target_profession TEXT;
      ALTER TABLE calls ADD COLUMN IF NOT EXISTS ragebait_trigger TEXT;
      ALTER TABLE calls ADD COLUMN IF NOT EXISTS uploaded_image_url TEXT;
      ALTER TABLE calls ADD COLUMN IF NOT EXISTS uploaded_image_s3_key TEXT;
      ALTER TABLE calls ADD COLUMN IF NOT EXISTS fhenix_enabled BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE calls ADD COLUMN IF NOT EXISTS fhenix_vault_id TEXT;
      ALTER TABLE calls ADD COLUMN IF NOT EXISTS video_s3_key TEXT;
    `);
    console.log("✅ New columns added!");
    
    // Verify columns exist
    const result = await driver.unsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'calls' 
      AND column_name IN ('target_city', 'target_hobby', 'target_profession', 'ragebait_trigger', 'uploaded_image_url', 'video_s3_key')
    `);
    
    console.log("📋 Verified columns:");
    for (const row of result) {
      console.log(`  ✅ ${row.column_name}`);
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await driver.end();
  }
}

if (import.meta.main) {
  addNewColumns()
    .then(() => {
      console.log("\n✨ Migration complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Failed:", error);
      process.exit(1);
    });
}

