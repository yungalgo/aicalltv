/**
 * Twilio recording download utilities
 */

import { env } from "~/env/server";

export interface DownloadRecordingOptions {
  recordingUrl: string;
  callId: string;
  maxRetries?: number;
}

/**
 * Download recording from Twilio with retry logic
 */
export async function downloadTwilioRecording(
  options: DownloadRecordingOptions,
): Promise<Buffer> {
  const { recordingUrl, callId, maxRetries = 3 } = options;

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new Error(
      "Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN",
    );
  }

  // Twilio recording URLs need authentication
  // Format: https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Recordings/{RecordingSid}
  const authHeader = Buffer.from(
    `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`,
  ).toString("base64");

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(recordingUrl, {
        headers: {
          Authorization: `Basic ${authHeader}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to download recording: ${response.status} ${response.statusText}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return buffer;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to download recording after ${maxRetries} attempts: ${lastError?.message}`,
  );
}

/**
 * Store recording in S3 and return S3 URL
 */
export async function storeRecordingInS3(
  recordingBuffer: Buffer,
  callId: string,
): Promise<string> {
  const { uploadAudioToS3 } = await import("~/lib/storage/s3");

  const s3Url = await uploadAudioToS3(
    recordingBuffer,
    callId,
    `recordings/${callId}.mp3`, // Store in recordings/ prefix
  );

  console.log(`[Twilio Recording] Stored recording in S3: ${s3Url}`);

  return s3Url;
}

