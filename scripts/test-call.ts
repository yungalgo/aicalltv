#!/usr/bin/env bun

/**
 * Direct test script to initiate a Twilio call
 * Usage: bun scripts/test-call.ts <phone-number> <recipient-name>
 * Example: bun scripts/test-call.ts "+15005550006" "Test User"
 * 
 * Environment:
 *   VOICE_PROVIDER=conversation_relay (default) | media_streams
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { env } from "../src/env/server";
import { calls } from "../src/lib/db/schema/calls";
import { user } from "../src/lib/db/schema/auth.schema";
import * as schema from "../src/lib/db/schema";
import { initiateTwilioCall } from "../src/lib/twilio/call";
import { getProviderInfo } from "../src/lib/twilio/providers";

async function main() {
  const phoneNumber = process.argv[2] || "+19083363673"; // Google Voice number
  const recipientName = process.argv[3] || "Test User";

  // Show provider info
  const providerInfo = getProviderInfo();
  
  console.log("=".repeat(60));
  console.log("📞 Making test call...");
  console.log("");
  console.log(`🎯 Provider: ${providerInfo.provider.toUpperCase()}`);
  console.log(`   ${providerInfo.description}`);
  console.log(`   TTS: ${providerInfo.tts}`);
  console.log(`   STT: ${providerInfo.stt}`);
  console.log("");
  console.log(`Phone Number: ${phoneNumber}`);
  console.log(`Recipient Name: ${recipientName}`);
  console.log("=".repeat(60));
  console.log("");

  try {
    // Create database connection
    const driver = postgres(env.DATABASE_URL);
    const db = drizzle({ client: driver, schema, casing: "snake_case" });

    // Get or create a test user
    let testUserId: string;
    const [existingUser] = await db
      .select()
      .from(user)
      .limit(1);

    if (existingUser) {
      testUserId = existingUser.id;
      console.log(`✓ Using existing user: ${existingUser.email}`);
    } else {
      // Create a test user if none exists
      const testUserEmail = `test-${Date.now()}@example.com`;
      const [newUser] = await db
        .insert(user)
        .values({
          id: `test-user-${Date.now()}`,
          name: "Test User",
          email: testUserEmail,
          emailVerified: false,
        })
        .returning();
      testUserId = newUser.id;
      console.log(`✓ Created test user: ${testUserEmail}`);
    }

    // Create call record with required fields
    const encryptedHandle = `encrypted_${phoneNumber}`;
    
    // AI personality/prompt - prank call style for testing!
    const aiPrompt = `You are "Barry from the International Cheese Council" making an urgent call to ${recipientName}.

Your mission: Convince them their cheese license has expired and they need to renew it immediately.

Your personality:
- Sound very official and serious about cheese regulations
- Use made-up cheese terminology ("cheddar compliance", "brie certification", "gouda violations")
- Ask absurd questions with a straight face ("When was your last cheese inspection?")
- If they question you, double down with more ridiculous cheese bureaucracy
- Keep responses SHORT (1-2 sentences max - this is a phone call!)

Start by asking if they're aware their cheese license expired last Tuesday. Be persistent but friendly!`;
    
    const [newCall] = await db
      .insert(calls)
      .values({
        userId: testUserId,
        recipientName,
        targetGender: "prefer_not_to_say",
        videoStyle: "anime",
        openaiPrompt: aiPrompt,
        encryptedHandle,
        paymentMethod: "free",
        isFree: true,
        status: "call_created",
      })
      .returning();
    
    console.log(`✓ AI Prompt: "${aiPrompt.substring(0, 50)}..."`)

    console.log(`✓ Created call record: ${newCall.id}`);

    // Initiate the call
    console.log("📞 Initiating Twilio call...");
    const callResult = await initiateTwilioCall(newCall);

    // Update call with Twilio Call SID
    await db
      .update(calls)
      .set({
        callSid: callResult.callSid,
        updatedAt: new Date(),
      })
      .where(eq(calls.id, newCall.id));

    await driver.end();

    console.log("");
    console.log("✅ Call initiated successfully!");
    console.log(`Call ID: ${newCall.id}`);
    console.log(`Call SID: ${callResult.callSid}`);
    console.log(`Phone Number: ${phoneNumber}`);
    console.log("");
    console.log("📊 Check Twilio console: https://console.twilio.com/us1/monitor/logs/calls");
    console.log(`   Look for Call SID: ${callResult.callSid}`);
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    if (error instanceof Error && 'code' in error) {
      console.error("Error code:", (error as Record<string, unknown>).code);
      console.error("Error details:", (error as Record<string, unknown>).detail);
    }
    console.error("Full error:", error);
    process.exit(1);
  }
}

main();
