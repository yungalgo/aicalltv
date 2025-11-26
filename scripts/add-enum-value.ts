import postgres from "postgres";
import { env } from "~/env/server";

async function addEnumValue() {
  const driver = postgres(env.DATABASE_URL);
  
  try {
    console.log("🔄 Adding 'prompt_ready' to call_status enum...");
    
    // Check if it already exists
    const check = await driver.unsafe(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'call_status'
      )
      AND enumlabel = 'prompt_ready';
    `);
    
    if (check.length > 0) {
      console.log("✅ 'prompt_ready' already exists in enum");
      return;
    }
    
    // Add the enum value
    await driver.unsafe(`
      ALTER TYPE call_status ADD VALUE 'prompt_ready';
    `);
    
    console.log("✅ Successfully added 'prompt_ready' to call_status enum");
    
    // Verify it was added
    const result = await driver.unsafe(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'call_status'
      )
      ORDER BY enumsortorder;
    `);
    
    console.log("\n📋 All call_status enum values:");
    result.forEach((r: any) => {
      console.log(`  ✅ ${r.enumlabel}`);
    });
    
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log("✅ 'prompt_ready' already exists in enum");
    } else {
      console.error("❌ Error:", error);
      throw error;
    }
  } finally {
    await driver.end();
  }
}

if (import.meta.main) {
  addEnumValue();
}
