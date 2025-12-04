/**
 * Wipe ALL data from ALL database tables
 * WARNING: This will delete ALL records including users, sessions, calls, credits, etc.
 * This keeps the schema intact but removes all data.
 * 
 * Usage: bun run scripts/wipe-all-data.ts
 */

import postgres from "postgres";
import { env } from "~/env/server";

async function wipeAllData() {
  console.log("🔄 Connecting to database...");
  const driver = postgres(env.DATABASE_URL);

  try {
    console.log("🗑️  Wiping all data from all tables...");
    console.log("");
    
    // Disable foreign key checks temporarily for easier truncation
    // PostgreSQL doesn't have a simple way to disable FK checks, so we'll use CASCADE
    
    // First, get all tables in the public schema
    const tables = await driver`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const tableNames = (tables as unknown as Array<{ table_name: string }>).map((t) => t.table_name);
    
    console.log(`📊 Found ${tableNames.length} tables:`);
    tableNames.forEach((name) => {
      console.log(`   - ${name}`);
    });
    console.log("");

    // Check pg-boss tables (in pgboss schema)
    const pgbossTables = await driver`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'pgboss' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `.catch(() => []); // pgboss schema might not exist

    const pgbossTableNames = (pgbossTables as unknown as Array<{ table_name: string }>).map((t) => t.table_name);
    
    if (pgbossTableNames.length > 0) {
      console.log(`📊 Found ${pgbossTableNames.length} pg-boss tables:`);
      pgbossTableNames.forEach((name) => {
        console.log(`   - pgboss.${name}`);
      });
      console.log("");
    }

    // Count records before deletion
    console.log("📊 Counting records before deletion...");
    for (const tableName of tableNames) {
      try {
        const count = await driver.unsafe(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const recordCount = Number((count[0] as unknown as { count: string | number }).count);
        if (recordCount > 0) {
          console.log(`   ${tableName}: ${recordCount} records`);
        }
      } catch (error) {
        // Some tables might not exist or have permission issues
        console.log(`   ${tableName}: (unable to count)`);
      }
    }
    console.log("");

    // Delete from tables in correct order (respecting foreign keys)
    // Start with tables that have foreign keys, then parent tables
    
    console.log("🗑️  Deleting data from tables...");
    
    // Delete from child tables first
    await driver.unsafe(`TRUNCATE TABLE calls CASCADE;`);
    console.log("   ✅ calls");
    
    await driver.unsafe(`TRUNCATE TABLE call_credits CASCADE;`);
    console.log("   ✅ call_credits");
    
    await driver.unsafe(`TRUNCATE TABLE call_analytics CASCADE;`);
    console.log("   ✅ call_analytics");
    
    await driver.unsafe(`TRUNCATE TABLE session CASCADE;`);
    console.log("   ✅ session");
    
    await driver.unsafe(`TRUNCATE TABLE account CASCADE;`);
    console.log("   ✅ account");
    
    await driver.unsafe(`TRUNCATE TABLE verification CASCADE;`);
    console.log("   ✅ verification");
    
    // Delete from parent tables (user is a reserved keyword, so quote it)
    await driver.unsafe(`TRUNCATE TABLE "user" CASCADE;`);
    console.log("   ✅ user");
    
    // Note: callers table is preserved - it contains seed data that should persist
    console.log("   ⏭️  callers (preserved - seed data)");
    
    // Clear pg-boss tables if they exist
    if (pgbossTableNames.length > 0) {
      console.log("");
      console.log("🗑️  Clearing pg-boss queue tables...");
      for (const tableName of pgbossTableNames) {
        try {
          await driver.unsafe(`TRUNCATE TABLE pgboss.${tableName} CASCADE;`);
          console.log(`   ✅ pgboss.${tableName}`);
        } catch (error) {
          console.log(`   ⚠️  pgboss.${tableName}: ${error instanceof Error ? error.message : "unknown error"}`);
        }
      }
    }

    // Reset sequences for tables with auto-increment IDs
    console.log("");
    console.log("🔄 Resetting sequences...");
    
    // Get all sequences
    const sequences = await driver`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public'
      ORDER BY sequence_name;
    `.catch(() => []);

    const sequenceNames = (sequences as unknown as Array<{ sequence_name: string }>).map((s) => s.sequence_name);
    
    for (const seqName of sequenceNames) {
      try {
        await driver.unsafe(`ALTER SEQUENCE ${seqName} RESTART WITH 1;`);
        console.log(`   ✅ ${seqName}`);
      } catch (error) {
        // Some sequences might be owned by tables that don't use them
        console.log(`   ⚠️  ${seqName}: (skipped)`);
      }
    }

    // Verify deletion (excluding callers table)
    console.log("");
    console.log("✅ Verification - counting records after deletion...");
    let totalRecords = 0;
    for (const tableName of tableNames) {
      // Skip callers table in verification
      if (tableName === "callers") {
        const count = await driver.unsafe(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const recordCount = Number((count[0] as unknown as { count: string | number }).count);
        console.log(`   ℹ️  ${tableName}: ${recordCount} records (preserved)`);
        continue;
      }
      try {
        const count = await driver.unsafe(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const recordCount = Number((count[0] as unknown as { count: string | number }).count);
        if (recordCount > 0) {
          console.log(`   ⚠️  ${tableName}: ${recordCount} records remaining`);
          totalRecords += recordCount;
        }
      } catch (error) {
        // Ignore errors
      }
    }

    if (totalRecords === 0) {
      console.log("   ✅ All tables are empty!");
    } else {
      console.log(`   ⚠️  Total records remaining: ${totalRecords}`);
    }

    console.log("");
    console.log("✨ Database wiped successfully!");
    console.log("");
    console.log("📝 Note: Schema is intact - tables and structure remain.");
    console.log("   All data has been deleted, including:");
    console.log("   - Users and accounts");
    console.log("   - Sessions");
    console.log("   - Calls");
    console.log("   - Credits");
    console.log("   - Call analytics");
    console.log("   - pg-boss queue jobs");
    console.log("");
    console.log("   ⚠️  Callers table was PRESERVED (contains seed data)");
    console.log("");
    console.log("💡 You can now start fresh with new data!");

  } catch (error) {
    console.error("❌ Error wiping database:", error);
    throw error;
  } finally {
    await driver.end();
  }
}

// Run if called directly
if (import.meta.main) {
  wipeAllData()
    .then(() => {
      console.log("");
      console.log("🎉 Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("");
      console.error("💥 Failed:", error);
      process.exit(1);
    });
}

