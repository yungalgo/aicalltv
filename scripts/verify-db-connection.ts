/**
 * Verify database connection and manually create schema if needed
 */

import postgres from "postgres";
import { env } from "~/env/server";

async function verifyConnection() {
  console.log("🔍 Testing database connection...");
  const driver = postgres(env.DATABASE_URL);

  try {
    // Test connection
    const result = await driver`SELECT version()`;
    console.log("✅ Database connected!");
    console.log(`   PostgreSQL version: ${result[0].version}`);

    // Check current tables
    const tables = await driver`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    console.log(`\n📊 Current tables: ${tables.length}`);
    if (tables.length === 0) {
      console.log("   ⚠️  No tables found - schema needs to be created");
      console.log("\n💡 Run: bunx drizzle-kit push");
      console.log("   (Type 'Yes, I want to execute all statements' when prompted)");
    } else {
      tables.forEach((t: any) => {
        console.log(`   - ${t.table_name}`);
      });
    }

  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  } finally {
    await driver.end();
  }
}

if (import.meta.main) {
  verifyConnection()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("💥 Failed:", error);
      process.exit(1);
    });
}

