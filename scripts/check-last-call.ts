/**
 * Check the most recent call record in the database
 * Verifies payment, encryption, and all call data
 * 
 * Run: bun run scripts/check-last-call.ts
 */

import postgres from "postgres";
import { env } from "~/env/server";
import { drizzle } from "drizzle-orm/postgres-js";
import { calls } from "~/lib/db/schema/calls";
import { callers } from "~/lib/db/schema/callers";
import { user } from "~/lib/db/schema/auth.schema";
import { desc, eq } from "drizzle-orm";
import * as schema from "~/lib/db/schema";

async function checkLastCall() {
  console.log("🔍 Checking most recent call record...\n");

  const driver = postgres(env.DATABASE_URL);
  const db = drizzle({ client: driver, schema, casing: "snake_case" });

  try {
    // Get the most recent call with related data
    const [latestCall] = await db
      .select({
        // Call basic info
        id: calls.id,
        userId: calls.userId,
        status: calls.status,
        recipientName: calls.recipientName,
        callerId: calls.callerId,
        
        // Payment info
        paymentMethod: calls.paymentMethod,
        paymentTxHash: calls.paymentTxHash,
        paymentAmount: calls.paymentAmount,
        isFree: calls.isFree,
        
        // Encryption info
        encryptedHandle: calls.encryptedHandle,
        
        // Call details
        targetGender: calls.targetGender,
        targetGenderCustom: calls.targetGenderCustom,
        targetAgeRange: calls.targetAgeRange,
        targetCity: calls.targetCity,
        targetHobby: calls.targetHobby,
        targetProfession: calls.targetProfession,
        interestingPiece: calls.interestingPiece,
        ragebaitTrigger: calls.ragebaitTrigger,
        videoStyle: calls.videoStyle,
        
        // Generated prompts
        openaiPrompt: calls.openaiPrompt,
        welcomeGreeting: calls.welcomeGreeting,
        
        // Call execution
        callSid: calls.callSid,
        recordingUrl: calls.recordingUrl,
        recordingSid: calls.recordingSid,
        duration: calls.duration,
        
        // Video
        videoUrl: calls.videoUrl,
        videoS3Key: calls.videoS3Key,
        videoStatus: calls.videoStatus,
        wavespeedJobId: calls.wavespeedJobId,
        videoErrorMessage: calls.videoErrorMessage,
        
        // Retry info
        attempts: calls.attempts,
        maxAttempts: calls.maxAttempts,
        firstAttemptAt: calls.firstAttemptAt,
        lastAttemptAt: calls.lastAttemptAt,
        nextRetryAt: calls.nextRetryAt,
        
        // Timestamps
        createdAt: calls.createdAt,
        updatedAt: calls.updatedAt,
      })
      .from(calls)
      .orderBy(desc(calls.createdAt))
      .limit(1);

    if (!latestCall) {
      console.log("❌ No calls found in database.");
      return;
    }

    console.log("=".repeat(70));
    console.log("📞 MOST RECENT CALL RECORD");
    console.log("=".repeat(70));
    console.log(`\n🆔 Call ID: ${latestCall.id}`);
    console.log(`📅 Created: ${latestCall.createdAt}`);
    console.log(`🔄 Updated: ${latestCall.updatedAt}`);
    console.log(`📊 Status: ${latestCall.status}`);

    // User info
    const [callUser] = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
      })
      .from(user)
      .where(eq(user.id, latestCall.userId))
      .limit(1);

    console.log(`\n👤 User:`);
    console.log(`   ID: ${callUser?.id || "Not found"}`);
    console.log(`   Email: ${callUser?.email || "Not found"}`);
    console.log(`   Name: ${callUser?.name || "Not found"}`);

    // Caller info
    if (latestCall.callerId) {
      const [caller] = await db
        .select({
          id: callers.id,
          name: callers.name,
          slug: callers.slug,
        })
        .from(callers)
        .where(eq(callers.id, latestCall.callerId))
        .limit(1);

      console.log(`\n🎭 Caller:`);
      console.log(`   ID: ${caller?.id || "Not found"}`);
      console.log(`   Name: ${caller?.name || "Not found"}`);
      console.log(`   Slug: ${caller?.slug || "Not found"}`);
    } else {
      console.log(`\n🎭 Caller: Not selected`);
    }

    // Recipient info
    console.log(`\n📞 Recipient:`);
    console.log(`   Name: ${latestCall.recipientName}`);
    console.log(`   Gender: ${latestCall.targetGender}${latestCall.targetGenderCustom ? ` (${latestCall.targetGenderCustom})` : ""}`);
    console.log(`   Age Range: ${latestCall.targetAgeRange || "Not specified"}`);
    console.log(`   City: ${latestCall.targetCity || "Not specified"}`);
    console.log(`   Hobby: ${latestCall.targetHobby || "Not specified"}`);
    console.log(`   Profession: ${latestCall.targetProfession || "Not specified"}`);
    console.log(`   Video Style: ${latestCall.videoStyle || "Not specified"}`);

    // Payment info
    console.log(`\n💳 Payment:`);
    console.log(`   Method: ${latestCall.paymentMethod || "Not set"}`);
    console.log(`   Is Free: ${latestCall.isFree ? "Yes" : "No"}`);
    if (latestCall.paymentTxHash) {
      console.log(`   Transaction Hash: ${latestCall.paymentTxHash}`);
    }
    if (latestCall.paymentAmount) {
      console.log(`   Amount: ${latestCall.paymentAmount}`);
    }

    // Encryption info
    console.log(`\n🔐 Encryption:`);
    if (latestCall.encryptedHandle) {
      if (latestCall.encryptedHandle.startsWith("fhenix:")) {
        const vaultId = latestCall.encryptedHandle.replace("fhenix:", "");
        console.log(`   ✅ Fhenix FHE Encryption`);
        console.log(`   Vault ID: ${vaultId}`);
      } else if (latestCall.encryptedHandle.startsWith("encrypted_")) {
        console.log(`   ⚠️  Legacy encryption (not Fhenix)`);
        console.log(`   Handle: ${latestCall.encryptedHandle.substring(0, 50)}...`);
      } else {
        console.log(`   Handle: ${latestCall.encryptedHandle}`);
      }
    } else {
      console.log(`   ❌ No encryption handle found`);
    }

    // Generated prompts
    console.log(`\n📝 Generated Prompts:`);
    if (latestCall.openaiPrompt) {
      const promptPreview = latestCall.openaiPrompt.substring(0, 200);
      console.log(`   ✅ OpenAI Prompt: ${promptPreview}...`);
    } else {
      console.log(`   ⚠️  OpenAI Prompt: Not generated yet`);
    }
    if (latestCall.welcomeGreeting) {
      console.log(`   ✅ Welcome Greeting: ${latestCall.welcomeGreeting}`);
    } else {
      console.log(`   ⚠️  Welcome Greeting: Not generated yet`);
    }

    // Call execution
    console.log(`\n📞 Call Execution:`);
    if (latestCall.callSid) {
      console.log(`   ✅ Call SID: ${latestCall.callSid}`);
    } else {
      console.log(`   ⚠️  Call SID: Not set (call not started yet)`);
    }
    if (latestCall.recordingUrl) {
      console.log(`   ✅ Recording URL: ${latestCall.recordingUrl.substring(0, 80)}...`);
    } else {
      console.log(`   ⚠️  Recording URL: Not available yet`);
    }
    if (latestCall.duration) {
      console.log(`   ✅ Duration: ${latestCall.duration} seconds`);
    }
    if (latestCall.attempts) {
      console.log(`   Attempts: ${latestCall.attempts}/${latestCall.maxAttempts}`);
    }

    // Video status
    console.log(`\n🎬 Video:`);
    if (latestCall.videoStatus) {
      console.log(`   Status: ${latestCall.videoStatus}`);
    } else {
      console.log(`   Status: Not started`);
    }
    if (latestCall.videoUrl) {
      console.log(`   ✅ Video URL: ${latestCall.videoUrl.substring(0, 80)}...`);
    }
    if (latestCall.wavespeedJobId) {
      console.log(`   Wavespeed Job ID: ${latestCall.wavespeedJobId}`);
    }
    if (latestCall.videoErrorMessage) {
      console.log(`   ❌ Error: ${latestCall.videoErrorMessage}`);
    }

    // Validation summary
    console.log(`\n` + "=".repeat(70));
    console.log("✅ VALIDATION SUMMARY");
    console.log("=".repeat(70));
    
    const checks = {
      "User ID": !!latestCall.userId,
      "Recipient Name": !!latestCall.recipientName,
      "Caller Selected": !!latestCall.callerId,
      "Payment Method": !!latestCall.paymentMethod,
      "Payment TX Hash": !!latestCall.paymentTxHash,
      "Fhenix Encryption": latestCall.encryptedHandle?.startsWith("fhenix:") || false,
      "OpenAI Prompt": !!latestCall.openaiPrompt,
      "Welcome Greeting": !!latestCall.welcomeGreeting,
    };

    let allPassed = true;
    for (const [check, passed] of Object.entries(checks)) {
      const icon = passed ? "✅" : "❌";
      console.log(`${icon} ${check}: ${passed ? "OK" : "MISSING"}`);
      if (!passed) allPassed = false;
    }

    console.log("=".repeat(70));
    if (allPassed) {
      console.log("\n✨ All critical fields are present!");
    } else {
      console.log("\n⚠️  Some fields are missing - call may still be processing");
    }

  } catch (error) {
    console.error("❌ Error checking call:", error);
    throw error;
  } finally {
    await driver.end();
  }
}

if (import.meta.main) {
  checkLastCall()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Failed:", error);
      process.exit(1);
    });
}

