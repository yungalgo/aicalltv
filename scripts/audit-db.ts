/**
 * Comprehensive database audit script
 * Checks all calls and credits for anomalies, missing data, and inconsistencies
 */

import postgres from "postgres";
import { env } from "~/env/server";

interface AuditResult {
  category: string;
  severity: "error" | "warning" | "info";
  message: string;
  count?: number;
  details?: Array<Record<string, unknown>>;
}

async function auditDatabase() {
  console.log("🔍 Starting comprehensive database audit...\n");
  const driver = postgres(env.DATABASE_URL);
  const results: AuditResult[] = [];

  try {
    // 1. Check for calls missing required fields
    console.log("📋 Checking calls for missing required fields...");
    const missingFields = await driver.unsafe(`
      SELECT 
        id,
        user_id,
        recipient_name,
        target_gender,
        status,
        payment_method,
        is_free,
        created_at
      FROM calls
      WHERE 
        recipient_name IS NULL OR recipient_name = ''
        OR target_gender IS NULL OR target_gender = ''
        OR user_id IS NULL
        OR status IS NULL
        OR payment_method IS NULL
      ORDER BY created_at DESC
      LIMIT 50;
    `);

    if (missingFields.length > 0) {
      results.push({
        category: "Missing Required Fields",
        severity: "error",
        message: `Found ${missingFields.length} calls with missing required fields`,
        count: missingFields.length,
        details: missingFields as Array<Record<string, unknown>>,
      });
    }

    // 2. Check for calls without consumed credits
    console.log("💳 Checking calls without consumed credits...");
    const callsWithoutCredits = await driver.unsafe(`
      SELECT 
        c.id,
        c.user_id,
        c.status,
        c.payment_method,
        c.is_free,
        c.created_at
      FROM calls c
      LEFT JOIN call_credits cc ON cc.call_id = c.id AND cc.state = 'consumed'
      WHERE cc.id IS NULL
        AND c.is_free = false
      ORDER BY c.created_at DESC
      LIMIT 50;
    `);

    if (callsWithoutCredits.length > 0) {
      results.push({
        category: "Calls Without Credits",
        severity: "error",
        message: `Found ${callsWithoutCredits.length} paid calls without consumed credits`,
        count: callsWithoutCredits.length,
        details: callsWithoutCredits as Array<Record<string, unknown>>,
      });
    }

    // 3. Check for consumed credits without calls
    console.log("🔍 Checking consumed credits without calls...");
    const orphanedCredits = await driver.unsafe(`
      SELECT 
        cc.id,
        cc.user_id,
        cc.call_id,
        cc.payment_method,
        cc.state,
        cc.created_at,
        cc.consumed_at
      FROM call_credits cc
      LEFT JOIN calls c ON c.id = cc.call_id
      WHERE cc.state = 'consumed' AND c.id IS NULL
      ORDER BY cc.consumed_at DESC
      LIMIT 50;
    `);

    if (orphanedCredits.length > 0) {
      results.push({
        category: "Orphaned Credits",
        severity: "error",
        message: `Found ${orphanedCredits.length} consumed credits pointing to non-existent calls`,
        count: orphanedCredits.length,
        details: orphanedCredits as Array<Record<string, unknown>>,
      });
    }

    // 4. Check for double-used credits (same credit used for multiple calls)
    console.log("🔄 Checking for double-used credits...");
    const doubleUsedCredits = await driver.unsafe(`
      SELECT 
        call_id,
        COUNT(*) as call_count,
        array_agg(id) as credit_ids,
        array_agg(user_id) as user_ids
      FROM call_credits
      WHERE state = 'consumed' AND call_id IS NOT NULL
      GROUP BY call_id
      HAVING COUNT(*) > 1
      ORDER BY call_count DESC
      LIMIT 50;
    `);

    if (doubleUsedCredits.length > 0) {
      results.push({
        category: "Double-Used Credits",
        severity: "error",
        message: `Found ${doubleUsedCredits.length} calls with multiple consumed credits`,
        count: doubleUsedCredits.length,
        details: doubleUsedCredits as Array<Record<string, unknown>>,
      });
    }

    // 5. Check for unused credits that should have been consumed
    console.log("⏳ Checking for stale unused credits...");
    const staleUnusedCredits = await driver.unsafe(`
      SELECT 
        COUNT(*) as count,
        payment_method,
        MIN(created_at) as oldest_credit
      FROM call_credits
      WHERE state = 'unused'
      GROUP BY payment_method
      ORDER BY count DESC;
    `);

    if (staleUnusedCredits.length > 0) {
      const totalUnused = staleUnusedCredits.reduce((sum: number, row: { count: number }) => sum + Number(row.count), 0);
      if (totalUnused > 0) {
        results.push({
          category: "Unused Credits",
          severity: "info",
          message: `Found ${totalUnused} unused credits (this is normal if users haven't created calls yet)`,
          count: totalUnused,
          details: staleUnusedCredits as Array<Record<string, unknown>>,
        });
      }
    }

    // 6. Check for calls marked as free but have payment method
    console.log("🆓 Checking for inconsistent free/payment flags...");
    const inconsistentFree = await driver.unsafe(`
      SELECT 
        id,
        user_id,
        is_free,
        payment_method,
        status,
        created_at
      FROM calls
      WHERE is_free = true 
        AND payment_method != 'free'
      ORDER BY created_at DESC
      LIMIT 50;
    `);

    if (inconsistentFree.length > 0) {
      results.push({
        category: "Inconsistent Free Flag",
        severity: "warning",
        message: `Found ${inconsistentFree.length} calls marked as free but with non-free payment method`,
        count: inconsistentFree.length,
        details: inconsistentFree as Array<Record<string, unknown>>,
      });
    }

    // 7. Check for calls with payment_method but no credit
    console.log("💰 Checking for calls with payment but no credit...");
    const paidWithoutCredit = await driver.unsafe(`
      SELECT 
        c.id,
        c.user_id,
        c.payment_method,
        c.is_free,
        c.status,
        c.created_at
      FROM calls c
      LEFT JOIN call_credits cc ON cc.call_id = c.id
      WHERE c.payment_method != 'free'
        AND c.is_free = false
        AND cc.id IS NULL
      ORDER BY c.created_at DESC
      LIMIT 50;
    `);

    if (paidWithoutCredit.length > 0) {
      results.push({
        category: "Paid Calls Without Credits",
        severity: "error",
        message: `Found ${paidWithoutCredit.length} paid calls without any credit record`,
        count: paidWithoutCredit.length,
        details: paidWithoutCredit as Array<Record<string, unknown>>,
      });
    }

    // 8. Check for duplicate payment references
    console.log("🔐 Checking for duplicate payment references...");
    const duplicatePaymentRefs = await driver.unsafe(`
      SELECT 
        payment_ref,
        COUNT(*) as count,
        array_agg(id) as credit_ids,
        array_agg(user_id) as user_ids,
        array_agg(state) as states
      FROM call_credits
      WHERE payment_ref IS NOT NULL
      GROUP BY payment_ref
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 50;
    `);

    if (duplicatePaymentRefs.length > 0) {
      results.push({
        category: "Duplicate Payment References",
        severity: "error",
        message: `Found ${duplicatePaymentRefs.length} payment references used multiple times (security issue!)`,
        count: duplicatePaymentRefs.length,
        details: duplicatePaymentRefs as Array<Record<string, unknown>>,
      });
    }

    // 9. Check for invalid status transitions
    console.log("📊 Checking for invalid status values...");
    const invalidStatuses = await driver.unsafe(`
      SELECT 
        id,
        status,
        video_status,
        created_at
      FROM calls
      WHERE status NOT IN ('call_created', 'prompt_ready', 'calling', 'completed', 'failed', 'cancelled')
        OR (video_status IS NOT NULL AND video_status NOT IN ('pending', 'generating', 'completed', 'failed'))
      ORDER BY created_at DESC
      LIMIT 50;
    `);

    if (invalidStatuses.length > 0) {
      results.push({
        category: "Invalid Status Values",
        severity: "warning",
        message: `Found ${invalidStatuses.length} calls with invalid status values`,
        count: invalidStatuses.length,
        details: invalidStatuses as Array<Record<string, unknown>>,
      });
    }

    // 10. Check for calls with video but no recording
    console.log("🎬 Checking video generation status...");
    const videoWithoutRecording = await driver.unsafe(`
      SELECT 
        id,
        video_status,
        recording_url,
        video_url,
        status,
        created_at
      FROM calls
      WHERE video_status IN ('generating', 'completed')
        AND (recording_url IS NULL OR recording_url = '')
      ORDER BY created_at DESC
      LIMIT 50;
    `);

    if (videoWithoutRecording.length > 0) {
      results.push({
        category: "Video Without Recording",
        severity: "warning",
        message: `Found ${videoWithoutRecording.length} calls with video status but no recording URL`,
        count: videoWithoutRecording.length,
        details: videoWithoutRecording as Array<Record<string, unknown>>,
      });
    }

    // 11. Check for calls stuck in calling status
    console.log("⏰ Checking for stuck calls...");
    const stuckCalls = await driver.unsafe(`
      SELECT 
        id,
        status,
        first_attempt_at,
        last_attempt_at,
        attempts,
        max_attempts,
        created_at,
        EXTRACT(EPOCH FROM (NOW() - COALESCE(last_attempt_at, first_attempt_at, created_at))) / 3600 as hours_stuck
      FROM calls
      WHERE status = 'calling'
        AND (
          last_attempt_at IS NULL 
          OR last_attempt_at < NOW() - INTERVAL '2 hours'
        )
      ORDER BY created_at DESC
      LIMIT 50;
    `);

    if (stuckCalls.length > 0) {
      results.push({
        category: "Stuck Calls",
        severity: "warning",
        message: `Found ${stuckCalls.length} calls stuck in 'calling' status for >2 hours`,
        count: stuckCalls.length,
        details: stuckCalls as Array<Record<string, unknown>>,
      });
    }

    // 12. Check for missing user references
    console.log("👤 Checking for orphaned calls...");
    const orphanedCalls = await driver.unsafe(`
      SELECT 
        c.id,
        c.user_id,
        c.status,
        c.created_at
      FROM calls c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE u.id IS NULL
      ORDER BY c.created_at DESC
      LIMIT 50;
    `);

    if (orphanedCalls.length > 0) {
      results.push({
        category: "Orphaned Calls",
        severity: "error",
        message: `Found ${orphanedCalls.length} calls with non-existent user references`,
        count: orphanedCalls.length,
        details: orphanedCalls as Array<Record<string, unknown>>,
      });
    }

    // 13. Check for credits with invalid states
    console.log("🔍 Checking credit states...");
    const invalidCreditStates = await driver.unsafe(`
      SELECT 
        id,
        user_id,
        state,
        call_id,
        payment_method,
        created_at
      FROM call_credits
      WHERE state NOT IN ('unused', 'consumed')
      ORDER BY created_at DESC
      LIMIT 50;
    `);

    if (invalidCreditStates.length > 0) {
      results.push({
        category: "Invalid Credit States",
        severity: "error",
        message: `Found ${invalidCreditStates.length} credits with invalid state values`,
        count: invalidCreditStates.length,
        details: invalidCreditStates as Array<Record<string, unknown>>,
      });
    }

    // 14. Check for calls with missing caller_id when they should have one
    console.log("📞 Checking caller assignments...");
    const missingCaller = await driver.unsafe(`
      SELECT 
        id,
        user_id,
        status,
        caller_id,
        created_at
      FROM calls
      WHERE caller_id IS NULL
        AND status IN ('prompt_ready', 'calling', 'completed')
        AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 50;
    `);

    if (missingCaller.length > 0) {
      results.push({
        category: "Missing Caller Assignment",
        severity: "warning",
        message: `Found ${missingCaller.length} recent active calls without caller_id`,
        count: missingCaller.length,
        details: missingCaller as Array<Record<string, unknown>>,
      });
    }

    // 15. Summary statistics
    console.log("📈 Gathering summary statistics...");
    const stats = await driver.unsafe(`
      SELECT 
        (SELECT COUNT(*) FROM calls) as total_calls,
        (SELECT COUNT(*) FROM call_credits) as total_credits,
        (SELECT COUNT(*) FROM call_credits WHERE state = 'unused') as unused_credits,
        (SELECT COUNT(*) FROM call_credits WHERE state = 'consumed') as consumed_credits,
        (SELECT COUNT(*) FROM calls WHERE is_free = true) as free_calls,
        (SELECT COUNT(*) FROM calls WHERE is_free = false) as paid_calls,
        (SELECT COUNT(*) FROM calls WHERE status = 'completed') as completed_calls,
        (SELECT COUNT(*) FROM calls WHERE status = 'failed') as failed_calls,
        (SELECT COUNT(*) FROM calls WHERE video_status = 'completed') as videos_completed;
    `);

    // Print results
    console.log("\n" + "=".repeat(80));
    console.log("📊 AUDIT RESULTS");
    console.log("=".repeat(80) + "\n");

    // Print summary stats first
    if (stats.length > 0) {
      const s = stats[0] as Record<string, unknown>;
      console.log("📈 SUMMARY STATISTICS:");
      console.log(`   Total Calls: ${s.total_calls}`);
      console.log(`   Total Credits: ${s.total_credits}`);
      console.log(`   Unused Credits: ${s.unused_credits}`);
      console.log(`   Consumed Credits: ${s.consumed_credits}`);
      console.log(`   Free Calls: ${s.free_calls}`);
      console.log(`   Paid Calls: ${s.paid_calls}`);
      console.log(`   Completed Calls: ${s.completed_calls}`);
      console.log(`   Failed Calls: ${s.failed_calls}`);
      console.log(`   Videos Completed: ${s.videos_completed}`);
      console.log();
    }

    // Group results by severity
    const errors = results.filter((r) => r.severity === "error");
    const warnings = results.filter((r) => r.severity === "warning");
    const info = results.filter((r) => r.severity === "info");

    if (errors.length > 0) {
      console.log("❌ ERRORS (" + errors.length + "):");
      errors.forEach((result) => {
        console.log(`\n   [${result.category}]`);
        console.log(`   ${result.message}`);
        if (result.details && result.details.length > 0 && result.details.length <= 5) {
          console.log(`   Examples:`);
          result.details.slice(0, 3).forEach((detail) => {
            console.log(`     - ${JSON.stringify(detail)}`);
          });
        }
      });
      console.log();
    }

    if (warnings.length > 0) {
      console.log("⚠️  WARNINGS (" + warnings.length + "):");
      warnings.forEach((result) => {
        console.log(`\n   [${result.category}]`);
        console.log(`   ${result.message}`);
        if (result.details && result.details.length > 0 && result.details.length <= 5) {
          console.log(`   Examples:`);
          result.details.slice(0, 3).forEach((detail) => {
            console.log(`     - ${JSON.stringify(detail)}`);
          });
        }
      });
      console.log();
    }

    if (info.length > 0) {
      console.log("ℹ️  INFO (" + info.length + "):");
      info.forEach((result) => {
        console.log(`\n   [${result.category}]`);
        console.log(`   ${result.message}`);
      });
      console.log();
    }

    if (errors.length === 0 && warnings.length === 0) {
      console.log("✅ No critical issues found! Database looks healthy.");
    }

    console.log("=".repeat(80));
    console.log(`\nTotal issues found: ${errors.length} errors, ${warnings.length} warnings`);

    return { errors, warnings, info, stats: stats[0] };
  } catch (error) {
    console.error("❌ Error during audit:", error);
    throw error;
  } finally {
    await driver.end();
  }
}

// Run if called directly
if (import.meta.main) {
  auditDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Audit failed:", error);
      process.exit(1);
    });
}

export { auditDatabase };

