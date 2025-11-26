import postgres from "postgres";
import { env } from "~/env/server";

async function checkEnum() {
  const driver = postgres(env.DATABASE_URL);
  
  try {
    const result = await driver.unsafe(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid 
        FROM pg_type 
        WHERE typname = 'call_status'
      )
      ORDER BY enumsortorder;
    `);
    
    console.log("📋 call_status enum values:");
    result.forEach((r: any) => {
      console.log(`  ✅ ${r.enumlabel}`);
    });
    
    const hasPromptReady = result.some((r: any) => r.enumlabel === 'prompt_ready');
    if (hasPromptReady) {
      console.log("\n✅ Migration successful! 'prompt_ready' status is available.");
    } else {
      console.log("\n❌ Migration incomplete! 'prompt_ready' status is missing.");
      console.log("   Run: ALTER TYPE call_status ADD VALUE 'prompt_ready';");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await driver.end();
  }
}

if (import.meta.main) {
  checkEnum();
}
