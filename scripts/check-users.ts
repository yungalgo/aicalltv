import postgres from "postgres";
import { env } from "~/env/server";

async function checkUsers() {
  const driver = postgres(env.DATABASE_URL);
  
  try {
    console.log("👤 Checking users...\n");
    
    const users = await driver.unsafe(`
      SELECT id, name, email, email_verified, free_call_credits, created_at
      FROM "user"
      ORDER BY created_at DESC
      LIMIT 10;
    `);
    
    if (users.length === 0) {
      console.log("❌ No users found in database");
    } else {
      console.log(`✅ Found ${users.length} user(s):\n`);
      users.forEach((user: any, index: number) => {
        console.log(`User ${index + 1}:`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Name: ${user.name}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Email Verified: ${user.email_verified}`);
        console.log(`  Free Call Credits: ${user.free_call_credits}`);
        console.log(`  Created: ${new Date(user.created_at).toLocaleString()}`);
        console.log("");
      });
    }
    
    console.log("🔐 Checking sessions...\n");
    
    const sessions = await driver.unsafe(`
      SELECT s.id, s.user_id, s.expires_at, s.created_at, u.email
      FROM session s
      JOIN "user" u ON s.user_id = u.id
      WHERE s.expires_at > NOW()
      ORDER BY s.created_at DESC
      LIMIT 5;
    `);
    
    if (sessions.length === 0) {
      console.log("⚠️  No active sessions found");
    } else {
      console.log(`✅ Found ${sessions.length} active session(s):\n`);
      sessions.forEach((session: any, index: number) => {
        console.log(`Session ${index + 1}:`);
        console.log(`  Session ID: ${session.id.substring(0, 20)}...`);
        console.log(`  User: ${session.email} (${session.user_id.substring(0, 20)}...)`);
        console.log(`  Expires: ${new Date(session.expires_at).toLocaleString()}`);
        console.log(`  Created: ${new Date(session.created_at).toLocaleString()}`);
        console.log("");
      });
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await driver.end();
  }
}

if (import.meta.main) {
  checkUsers();
}
