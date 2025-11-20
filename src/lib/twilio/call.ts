import { getTwilioClient, isTwilioConfigured } from "./client";
import { env } from "~/env/server";
import type { calls } from "~/lib/db/schema/calls";

type CallRecord = typeof calls.$inferSelect;

/**
 * Initiate a Twilio call
 * @param call - Call record from database
 * @returns Call SID and recording SID
 */
export async function initiateTwilioCall(
  call: CallRecord,
): Promise<{
  callSid: string;
  recordingSid?: string;
}> {
  const client = getTwilioClient();

  if (!client) {
    throw new Error("Twilio is not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER");
  }

  if (!env.TWILIO_PHONE_NUMBER) {
    throw new Error("TWILIO_PHONE_NUMBER is not set");
  }

  // Extract phone number from encrypted handle
  // TODO: Decrypt using Fhenix CoFHE when encryption is implemented
  const phoneNumber = call.encryptedHandle?.replace("encrypted_", "") || "";
  
  if (!phoneNumber) {
    throw new Error("Phone number not found in call record");
  }

  // Webhook URLs for call status updates
  const statusCallbackUrl = `${env.VITE_BASE_URL}/api/webhooks/twilio/call-status`;
  const recordingStatusCallbackUrl = `${env.VITE_BASE_URL}/api/webhooks/twilio/recording-status`;
  const twimlUrl = `${env.VITE_BASE_URL}/api/twilio/voice`;

  console.log("=".repeat(80));
  console.log("[Twilio Call] 📞 Initiating call to:", phoneNumber);
  console.log("[Twilio Call] TwiML URL:", twimlUrl);
  console.log("[Twilio Call] Status callback:", statusCallbackUrl);
  console.log("[Twilio Call] Recording callback:", recordingStatusCallbackUrl);
  console.log("=".repeat(80));

  // Make the call with Media Stream enabled AND dual-channel recording
  // Media Stream: Real-time audio via WebSocket (for live processing)
  // Dual-channel recording: Stereo WAV/MP3 file (left=caller, right=callee) for post-call processing
  const twilioCall = await client.calls.create({
    to: phoneNumber,
    from: env.TWILIO_PHONE_NUMBER,
    url: twimlUrl, // TwiML endpoint that starts Media Stream
    statusCallback: statusCallbackUrl,
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    statusCallbackMethod: "POST",
    record: true, // Enable recording
    recordingChannels: "dual", // Dual-channel: left=caller, right=callee (stereo)
    recordingStatusCallback: recordingStatusCallbackUrl,
    recordingStatusCallbackMethod: "POST",
    // Note: Media Stream is configured in the TwiML response, not here
  });

  return {
    callSid: twilioCall.sid,
    recordingSid: twilioCall.sid, // Recording SID will come from webhook
  };
}

/**
 * Check if Twilio is ready to make calls
 */
export function canMakeTwilioCall(): boolean {
  return isTwilioConfigured();
}

