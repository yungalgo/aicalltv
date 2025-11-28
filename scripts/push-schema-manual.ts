/**
 * Manually push schema using Drizzle's push API
 * This bypasses drizzle-kit's interactive prompts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { env } from "~/env/server";
import * as schema from "~/lib/db/schema";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function pushSchema() {
  console.log("🔄 Pushing schema to database...");
  const driver = postgres(env.DATABASE_URL);
  const db = drizzle({ client: driver, schema, casing: "snake_case" });

  try {
    console.log("📦 Creating tables and types...");
    
    // This will create all tables defined in schema
    await db.execute(sql`
      -- Create enums first
      DO $$ BEGIN
        CREATE TYPE call_status AS ENUM ('call_created', 'call_attempted', 'call_complete', 'call_failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE payment_method AS ENUM ('free', 'near_ai', 'sol', 'mina', 'zcash', 'web3_wallet');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE video_status AS ENUM ('pending', 'generating', 'completed', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log("✅ Enums created");
    console.log("⚠️  Note: Tables need to be created via drizzle-kit push");
    console.log("   The schema is complex and requires drizzle-kit's migration system");
    
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await driver.end();
  }
}

// Actually, let's use a simpler approach - check if drizzle-kit can see the schema
async function checkSchema() {
  console.log("🔍 Checking if drizzle-kit can read schema...");
  
  try {
    // Try to import and validate schema
    const schemaModule = await import("~/lib/db/schema");
    console.log("✅ Schema module loaded successfully");
    console.log("   Exports:", Object.keys(schemaModule));
    
    // Check if tables are defined
    if (schemaModule.calls) {
      console.log("✅ 'calls' table schema found");
    }
    if (schemaModule.user) {
      console.log("✅ 'user' table schema found");
    }
    
  } catch (error) {
    console.error("❌ Error loading schema:", error);
  }
}

if (import.meta.main) {
  checkSchema()
    .then(() => {
      console.log("\n💡 If schema loads correctly, try:");
      console.log("   bunx drizzle-kit push --force");
      console.log("   or check drizzle.config.ts settings");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Failed:", error);
      process.exit(1);
    });
}

