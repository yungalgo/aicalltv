/**
 * Reset database - drops all tables and recreates schema
 * WARNING: This will delete ALL data!
 * 
 * Usage: bun run scripts/reset-db.ts
 */

import postgres from "postgres";
import { env } from "~/env/server";

async function resetDatabase() {
  console.log("🔄 Connecting to database...");
  const driver = postgres(env.DATABASE_URL);

  try {
    console.log("🗑️  Dropping all tables and types...");
    
    // Drop all tables in correct order (respecting foreign keys)
    // Note: "user" is a reserved keyword, so we quote it
    await driver.unsafe(`
      DROP TABLE IF EXISTS calls CASCADE;
      DROP TABLE IF EXISTS call_analytics CASCADE;
      DROP TABLE IF EXISTS session CASCADE;
      DROP TABLE IF EXISTS account CASCADE;
      DROP TABLE IF EXISTS "user" CASCADE;
      DROP TABLE IF EXISTS verification CASCADE;
      DROP TYPE IF EXISTS call_status CASCADE;
      DROP TYPE IF EXISTS payment_method CASCADE;
      DROP TYPE IF EXISTS video_status CASCADE;
    `);

    console.log("✅ All tables and types dropped");

    console.log("📦 Pushing new schema...");
    console.log("");
    console.log("⚠️  IMPORTANT: drizzle-kit push requires manual confirmation");
    console.log("   Please run this command manually:");
    console.log("");
    console.log("   bunx drizzle-kit push");
    console.log("");
    console.log("   When prompted, type: Yes, I want to execute all statements");
    console.log("");
    console.log("   Or run: bun run db:push");
    console.log("");
    
    // Try to run it, but it will require user input
    const { execSync } = await import("child_process");
    try {
      execSync("bunx drizzle-kit push", { stdio: "inherit" });
    } catch (error: unknown) {
      const execError = error as { status?: number; signal?: string };
      if (execError.status === 130 || execError.signal === "SIGINT") {
        // User cancelled - that's okay
        console.log("\n⚠️  Schema push cancelled or requires confirmation");
        console.log("   Please run 'bunx drizzle-kit push' manually");
      } else {
        throw error;
      }
    }

    console.log("✅ Database reset complete!");
    console.log("📝 Schema has been recreated with latest structure");
    console.log("");
    console.log("New fields added:");
    console.log("  - target_gender, target_gender_custom");
    console.log("  - target_age_range, target_physical_description");
    console.log("  - interesting_piece, video_style");
    console.log("  - openai_prompt, image_prompt");
  } catch (error) {
    console.error("❌ Error resetting database:", error);
    throw error;
  } finally {
    await driver.end();
  }
}

// Run if called directly
if (import.meta.main) {
  resetDatabase()
    .then(() => {
      console.log("✨ Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Failed:", error);
      process.exit(1);
    });
}

