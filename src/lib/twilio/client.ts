import twilio from "twilio";
import { env } from "~/env/server";

let twilioClient: ReturnType<typeof twilio> | null = null;

/**
 * Get Twilio client instance
 * Returns null if credentials are not configured
 */
export function getTwilioClient() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    return null;
  }

  if (!twilioClient) {
    twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }

  return twilioClient;
}

/**
 * Check if Twilio is configured
 */
export function isTwilioConfigured(): boolean {
  return !!(
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    env.TWILIO_PHONE_NUMBER
  );
}

