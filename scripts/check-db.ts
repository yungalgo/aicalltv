/**
 * Check database schema and verify all tables/columns exist
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "~/env/server";
import * as schema from "~/lib/db/schema";
import { sql } from "drizzle-orm";

async function checkDatabase() {
  console.log("🔍 Checking database schema...\n");
  const driver = postgres(env.DATABASE_URL);
  const db = drizzle({ client: driver, schema, casing: "snake_case" });

  try {
    // Check if tables exist
    const tables = await driver.unsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log("📊 Tables found:");
    const tableNames = tables.map((t: any) => t.table_name);
    tableNames.forEach((name: string) => {
      console.log(`  ✅ ${name}`);
    });

    // Check calls table structure
    console.log("\n📋 Checking 'calls' table structure:");
    const callsColumns = await driver.unsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'calls'
      ORDER BY ordinal_position;
    `);

    const expectedColumns = [
      "id",
      "user_id",
      "status",
      "recipient_name",
      "recipient_context",
      "target_gender",
      "target_gender_custom",
      "target_age_range",
      "target_physical_description",
      "interesting_piece",
      "video_style",
      "openai_prompt",
      "image_prompt",
      "script",
      "attempts",
      "max_attempts",
      "first_attempt_at",
      "last_attempt_at",
      "days_since_first_attempt",
      "next_retry_at",
      "is_free",
      "payment_method",
      "payment_tx_hash",
      "payment_amount",
      "encrypted_handle",
      "call_sid",
      "recording_url",
      "recording_sid",
      "duration",
      "video_url",
      "video_status",
      "wavespeed_job_id",
      "video_error_message",
      "created_at",
      "updated_at",
    ];

    const foundColumns = callsColumns.map((c: any) => c.column_name);
    
    console.log(`  Total columns: ${foundColumns.length}`);
    console.log("\n  New fields check:");
    const newFields = [
      "target_gender",
      "target_gender_custom",
      "target_age_range",
      "target_physical_description",
      "interesting_piece",
      "video_style",
      "openai_prompt",
      "image_prompt",
    ];

    let allPresent = true;
    for (const field of newFields) {
      if (foundColumns.includes(field)) {
        console.log(`    ✅ ${field}`);
      } else {
        console.log(`    ❌ ${field} - MISSING!`);
        allPresent = false;
      }
    }

    // Check enums
    console.log("\n🔢 Checking enums:");
    const enums = await driver.unsafe(`
      SELECT typname 
      FROM pg_type 
      WHERE typtype = 'e'
      ORDER BY typname;
    `);

    const enumNames = enums.map((e: any) => e.typname);
    const expectedEnums = ["call_status", "payment_method", "video_status"];
    
    expectedEnums.forEach((enumName) => {
      if (enumNames.includes(enumName)) {
        console.log(`  ✅ ${enumName}`);
      } else {
        console.log(`  ❌ ${enumName} - MISSING!`);
      }
    });

    // Check foreign keys
    console.log("\n🔗 Checking foreign keys:");
    const foreignKeys = await driver.unsafe(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'calls';
    `);

    if (foreignKeys.length > 0) {
      foreignKeys.forEach((fk: any) => {
        console.log(`  ✅ ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
    } else {
      console.log("  ⚠️  No foreign keys found");
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    if (allPresent && tableNames.length >= 6) {
      console.log("✅ Database is ready!");
      console.log(`   ${tableNames.length} tables created`);
      console.log(`   All new fields present`);
      console.log(`   Enums configured`);
    } else {
      console.log("⚠️  Database may be incomplete");
      if (!allPresent) {
        console.log("   Some new fields are missing");
      }
    }
    console.log("=".repeat(50));

  } catch (error) {
    console.error("❌ Error checking database:", error);
    throw error;
  } finally {
    await driver.end();
  }
}

// Run if called directly
if (import.meta.main) {
  checkDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Failed:", error);
      process.exit(1);
    });
}

