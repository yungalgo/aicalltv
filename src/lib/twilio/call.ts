import { getTwilioClient, isTwilioConfigured } from "./client";
import { env } from "~/env/server";
import type { calls } from "~/lib/db/schema/calls";
import { extractPhoneNumber, isFhenixEncrypted } from "~/lib/fhenix/backend-decrypt";

type CallRecord = typeof calls.$inferSelect;

interface CacheData {
  callSid: string;
  openaiPrompt: string;
  welcomeGreeting?: string;
}

/**
 * Cache call data to the WebSocket server for faster session initialization
 */
async function cacheCallDataToWebSocket(data: CacheData): Promise<void> {
  // WebSocket server runs on port 3001 in production, configurable via WS_PORT
  const port = process.env.WS_PORT || "3001";
  const cacheUrl = `http://localhost:${port}/cache/call`;
  
  try {
    const response = await fetch(cacheUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    
    if (response.ok) {
      console.log(`[Twilio Call] ✅ Cached call data to WebSocket server`);
    } else {
      console.warn(`[Twilio Call] ⚠️ Failed to cache call data: ${response.status}`);
    }
  } catch (error) {
    // Non-fatal - WebSocket server might not be running yet
    console.warn(`[Twilio Call] ⚠️ Could not cache call data (WS server may not be running):`, error);
  }
}

/**
 * Initiate a Twilio call using ConversationRelay
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
  // Supports both legacy (encrypted_+1...) and Fhenix (fhenix:0x...) formats
  const phoneNumber = await extractPhoneNumber(call.encryptedHandle);
  
  if (!phoneNumber) {
    // Check if this is a Fhenix call that needs decryption
    if (isFhenixEncrypted(call.encryptedHandle)) {
      throw new Error("Fhenix FHE decryption required - backend decryption not fully implemented for hackathon. Phone stored securely on-chain at vault ID: " + call.fhenixVaultId);
    }
    throw new Error("Phone number not found in call record");
  }

  // TwiML URL with call ID for fetching call-specific data (welcome greeting, etc.)
  const twimlUrl = `${env.VITE_BASE_URL}/api/twilio/voice?callId=${call.id}`;

  // Webhook URLs for call status updates
  const statusCallbackUrl = `${env.VITE_BASE_URL}/api/webhooks/twilio/call-status`;
  const recordingStatusCallbackUrl = `${env.VITE_BASE_URL}/api/webhooks/twilio/recording-status`;

  console.log("=".repeat(80));
  console.log("[Twilio Call] 📞 Initiating call to:", phoneNumber);
  console.log("[Twilio Call] 🎙️  Using ConversationRelay (ElevenLabs TTS + Deepgram STT)");
  console.log("[Twilio Call] TwiML URL:", twimlUrl);
  console.log("[Twilio Call] Status callback:", statusCallbackUrl);
  console.log("[Twilio Call] Recording callback:", recordingStatusCallbackUrl);
  console.log("=".repeat(80));

  // Make the call with recording enabled
  const twilioCall = await client.calls.create({
    to: phoneNumber,
    from: env.TWILIO_PHONE_NUMBER,
    url: twimlUrl,
    statusCallback: statusCallbackUrl,
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    statusCallbackMethod: "POST",
    record: true,
    recordingChannels: "dual", // Dual-channel: left=caller/AI, right=target/person (stereo)
    recordingStatusCallback: recordingStatusCallbackUrl,
    recordingStatusCallbackMethod: "POST",
  });

  // Cache call data to WebSocket server for faster session initialization
  if (call.openaiPrompt) {
    await cacheCallDataToWebSocket({
      callSid: twilioCall.sid,
      openaiPrompt: call.openaiPrompt,
      welcomeGreeting: call.welcomeGreeting || undefined,
    });
  }

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
