import { eq, and } from "drizzle-orm";
import { calls } from "~/lib/db/schema/calls";
import { callAnalytics } from "~/lib/db/schema/call-analytics";
import { createHash } from "crypto";

// TCPA Compliance Constants
const MAX_CALLS_PER_DAY_PER_NUMBER = 3; // TCPA limit
const MAX_RETRY_DAYS = 5; // Retry for 5 days
const CALLING_HOURS_START = 9; // 9 AM local time
const CALLING_HOURS_END = 21; // 9 PM local time (21:00)

// Retry time slots (hours in local timezone) - spread across the day
const RETRY_TIME_SLOTS = [
  10, // 10 AM - Morning
  14, // 2 PM - Afternoon
  18, // 6 PM - Evening
];

/**
 * Hash phone number for analytics tracking (privacy-preserving)
 */
function hashPhoneNumber(phoneNumber: string): string {
  return createHash("sha256").update(phoneNumber).digest("hex");
}

/**
 * Extract phone number from encrypted handle
 * Currently stored as "encrypted_<phoneNumber>" - will be properly encrypted later
 */
function extractPhoneNumber(encryptedHandle: string): string {
  // For now, phone number is stored as "encrypted_<phoneNumber>"
  // TODO: Decrypt using Fhenix CoFHE when encryption is implemented
  if (encryptedHandle.startsWith("encrypted_")) {
    return encryptedHandle.replace("encrypted_", "");
  }
  return encryptedHandle;
}

/**
 * Get timezone for a phone number using us-area-codes package
 * Maps US area codes to their timezones
 */
export function getTimezoneForPhoneNumber(phoneNumber: string): string {
  // Extract phone number if it's in encrypted format
  const cleanPhone = extractPhoneNumber(phoneNumber);
  
  // Extract area code
  const digits = cleanPhone.replace(/\D/g, "");
  if (digits.length >= 10) {
    const areaCode = digits.substring(digits.length - 10, digits.length - 7);
    
    try {
      // Simple area code to timezone mapping (US only)
      // Inline mapping to avoid ESM/CommonJS issues
      const AREA_CODE_TIMEZONE: Record<string, string> = {
        // Eastern Time (NJ, NY, PA, etc.)
        "201": "America/New_York", "212": "America/New_York", "215": "America/New_York",
        "267": "America/New_York", "302": "America/New_York", "347": "America/New_York",
        "484": "America/New_York", "516": "America/New_York", "518": "America/New_York",
        "551": "America/New_York", "570": "America/New_York", "610": "America/New_York",
        "646": "America/New_York", "609": "America/New_York", "718": "America/New_York",
        "732": "America/New_York", "848": "America/New_York", "856": "America/New_York",
        "862": "America/New_York", "908": "America/New_York", "917": "America/New_York",
        "929": "America/New_York", "973": "America/New_York",
          // Central Time
        "312": "America/Chicago", "214": "America/Chicago", "469": "America/Chicago",
        "512": "America/Chicago", "713": "America/Chicago", "832": "America/Chicago",
          // Mountain Time
        "303": "America/Denver", "720": "America/Denver", "505": "America/Denver",
        "602": "America/Phoenix", "480": "America/Phoenix",
          // Pacific Time
        "213": "America/Los_Angeles", "310": "America/Los_Angeles", "323": "America/Los_Angeles",
        "408": "America/Los_Angeles", "415": "America/Los_Angeles", "510": "America/Los_Angeles",
        "619": "America/Los_Angeles", "650": "America/Los_Angeles", "818": "America/Los_Angeles",
        "858": "America/Los_Angeles", "925": "America/Los_Angeles", "949": "America/Los_Angeles",
        };
        
      const timezone = AREA_CODE_TIMEZONE[areaCode];
        if (timezone) {
          return timezone;
      }
      
      // No match in our common area codes, fall through to default
    } catch (error) {
      console.warn(`[Retry Logic] Error looking up area code ${areaCode}:`, error);
    }
  }
  
  // Default to Eastern Time if lookup fails
  return "America/New_York";
}

/**
 * Check if we can make a call today (daily limit check)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function canMakeCallToday(db: any,
  encryptedHandle: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const phoneNumber = extractPhoneNumber(encryptedHandle);
  const phoneHash = hashPhoneNumber(phoneNumber);
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Check call_analytics for today's count
  const [analytics] = await db
    .select()
    .from(callAnalytics)
    .where(
      and(
        eq(callAnalytics.phoneNumberHash, phoneHash),
        eq(callAnalytics.date, today),
      ),
    )
    .limit(1);

  if (analytics && analytics.callCount >= MAX_CALLS_PER_DAY_PER_NUMBER) {
    return {
      allowed: false,
      reason: `Daily call limit reached (${MAX_CALLS_PER_DAY_PER_NUMBER} calls/day)`,
    };
  }

  return { allowed: true };
}

/**
 * Increment daily call count
 */
export async function incrementDailyCallCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  encryptedHandle: string,
): Promise<void> {
  const phoneNumber = extractPhoneNumber(encryptedHandle);
  const phoneHash = hashPhoneNumber(phoneNumber);
  const today = new Date().toISOString().split("T")[0];

  const [existing] = await db
    .select()
    .from(callAnalytics)
    .where(
      and(
        eq(callAnalytics.phoneNumberHash, phoneHash),
        eq(callAnalytics.date, today),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(callAnalytics)
      .set({
        callCount: existing.callCount + 1,
      })
      .where(eq(callAnalytics.id, existing.id));
  } else {
    await db.insert(callAnalytics).values({
      phoneNumberHash: phoneHash,
      date: today,
      callCount: 1,
    });
  }
}

/**
 * Check if current time is within calling hours for the phone number's timezone
 * Returns true if we can call RIGHT NOW
 */
export function isWithinCallingHours(encryptedHandle: string): boolean {
  // In development, testing mode, or if BYPASS_CALLING_HOURS is set, always allow calls (bypass time restrictions)
  if (process.env.NODE_ENV !== "production" || 
      process.env.TESTING_MODE === "true" || 
      process.env.BYPASS_CALLING_HOURS === "true") {
    return true;
  }

  const phoneNumber = extractPhoneNumber(encryptedHandle);
  const timezone = getTimezoneForPhoneNumber(phoneNumber);
  const now = new Date();
  
  // Get current hour in the phone number's timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const currentHour = parseInt(
    parts.find((p) => p.type === "hour")?.value || "0",
    10,
  );

  // Check if current hour is within allowed calling hours (9 AM - 9 PM)
  return currentHour >= CALLING_HOURS_START && currentHour < CALLING_HOURS_END;
}

/**
 * Calculate next retry time based on:
 * - Days since first attempt
 * - Time slots available today
 * - Timezone restrictions
 */
export function calculateNextRetryTime(
  encryptedHandle: string,
  daysSinceFirstAttempt: number,
): Date | null {
  if (daysSinceFirstAttempt >= MAX_RETRY_DAYS) {
    return null; // No more retries
  }

  const phoneNumber = extractPhoneNumber(encryptedHandle);
  const timezone = getTimezoneForPhoneNumber(phoneNumber);
  const now = new Date();
  
  // Get current time in phone number's timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  // Get current hour for timezone-aware scheduling
  parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);

  // Determine which time slot to use based on days since first attempt
  const slotIndex = daysSinceFirstAttempt % RETRY_TIME_SLOTS.length;
  const targetHour = RETRY_TIME_SLOTS[slotIndex];

  // Calculate days to add (spread across 5 days)
  const daysToAdd = Math.min(daysSinceFirstAttempt, MAX_RETRY_DAYS - 1);

  // Create retry date in the phone number's timezone
  // We'll create it in UTC but target the local time
  const retryDate = new Date(now);
  retryDate.setUTCDate(retryDate.getUTCDate() + daysToAdd);
  
  // Set the target hour (in UTC, accounting for timezone offset)
  // This is simplified - in production, use a library like date-fns-tz
  const offsetHours = getTimezoneOffsetHours(timezone);
  retryDate.setUTCHours(targetHour - offsetHours, 0, 0, 0);

  // Ensure it's within calling hours
  if (targetHour < CALLING_HOURS_START) {
    retryDate.setUTCHours(CALLING_HOURS_START - offsetHours, 0, 0, 0);
  } else if (targetHour >= CALLING_HOURS_END) {
    retryDate.setUTCDate(retryDate.getUTCDate() + 1);
    retryDate.setUTCHours(RETRY_TIME_SLOTS[0] - offsetHours, 0, 0, 0);
  }

  // If the calculated time is in the past, move to next day
  if (retryDate <= now) {
    retryDate.setUTCDate(retryDate.getUTCDate() + 1);
  }

  return retryDate;
}

/**
 * Get timezone offset in hours (simplified)
 * In production, use a proper timezone library
 */
function getTimezoneOffsetHours(timezone: string): number {
  const now = new Date();
  const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const local = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  return (local.getTime() - utc.getTime()) / (1000 * 60 * 60);
}

/**
 * Check if a call should be retried now
 */
export async function shouldRetryCall(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  callId: string,
): Promise<{ shouldRetry: boolean; reason?: string }> {
  // In development, testing mode, or if BYPASS_CALLING_HOURS is set, skip all checks and allow calls
  if (process.env.NODE_ENV !== "production" || 
      process.env.TESTING_MODE === "true" || 
      process.env.BYPASS_CALLING_HOURS === "true") {
    return { shouldRetry: true };
  }

  const [call] = await db
    .select()
    .from(calls)
    .where(eq(calls.id, callId))
    .limit(1);

  if (!call) {
    return { shouldRetry: false, reason: "Call not found" };
  }

  // Check if max retry days exceeded
  if (call.daysSinceFirstAttempt >= MAX_RETRY_DAYS) {
    return { shouldRetry: false, reason: "Max retry days exceeded" };
  }

  // Check daily call limit FIRST (TCPA compliance)
  const canCall = await canMakeCallToday(db, call.encryptedHandle || "");
  if (!canCall.allowed) {
    return { shouldRetry: false, reason: canCall.reason };
  }

  // Check if we're within calling hours - if YES, call immediately!
  if (!isWithinCallingHours(call.encryptedHandle || "")) {
    return { shouldRetry: false, reason: "Outside calling hours" };
  }

  // Check if next retry time has arrived (for scheduled retries)
  if (call.nextRetryAt && new Date() < call.nextRetryAt) {
    return { shouldRetry: false, reason: "Next retry time not reached" };
  }

  // All checks passed - we can call RIGHT NOW!
  return { shouldRetry: true };
}

