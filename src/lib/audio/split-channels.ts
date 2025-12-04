/**
 * Audio processing utilities for splitting stereo audio
 * 
 * Twilio dual-channel recording layout:
 * - LEFT channel = target (the person being called/pranked)
 * - RIGHT channel = caller (the AI making the call)
 * 
 * Image/Video layout:
 * - TOP = caller (AI)
 * - BOTTOM = target (person)
 */

import ffmpeg from "fluent-ffmpeg";
import { getTempFilePath } from "~/lib/utils/temp-cleanup";
import { uploadFileToS3 } from "~/lib/storage/s3";
import { retryWithBackoff } from "~/lib/utils/retry";

export interface SplitAudioResult {
  callerAudioPath: string; // Local temp file path - AI caller
  targetAudioPath: string; // Local temp file path - target person
  callerS3Url: string; // S3 URL for caller (AI) audio
  targetS3Url: string; // S3 URL for target (person) audio
}

/**
 * Split stereo audio file into caller and target channels
 * 
 * Twilio dual-channel layout:
 * - LEFT channel (FL) = target (person being called)
 * - RIGHT channel (FR) = caller (AI)
 * 
 * @param inputPath - Path to input stereo audio file
 * @param callId - Call ID for naming output files
 * @returns Paths to split audio files and their S3 URLs
 */
export async function splitStereoAudio(
  inputPath: string,
  callId: string,
): Promise<SplitAudioResult> {
  const callerAudioPath = getTempFilePath(callId, "caller", "mp3");
  const targetAudioPath = getTempFilePath(callId, "target", "mp3");

  console.log(`[Audio Split] Splitting stereo audio for call ${callId}`);

  // Extract RIGHT channel = caller (AI) audio
  // Twilio dual-channel: RIGHT = the "from" party (our AI caller)
  await retryWithBackoff(
    () =>
      new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .audioFilters([
            "pan=mono|c0=FR", // Extract RIGHT channel (caller/AI) as mono
          ])
          .output(callerAudioPath)
          .on("end", () => {
            resolve();
          })
          .on("error", (error: Error) => {
            console.error(`[Audio Split] ❌ Error extracting caller audio:`, error);
            reject(error);
          })
          .run();
      }),
    { maxRetries: 2, initialDelay: 1000 },
  );

  // Extract LEFT channel = target (person being called) audio
  // Twilio dual-channel: LEFT = the "to" party (target person)
  await retryWithBackoff(
    () =>
      new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .audioFilters([
            "pan=mono|c0=FL", // Extract LEFT channel (target/person) as mono
          ])
          .output(targetAudioPath)
          .on("end", () => {
            resolve();
          })
          .on("error", (error: Error) => {
            console.error(`[Audio Split] ❌ Error extracting target audio:`, error);
            reject(error);
          })
          .run();
      }),
    { maxRetries: 2, initialDelay: 1000 },
  );

  // Upload both channels to S3 for WavespeedAI multi model
  const [callerS3Url, targetS3Url] = await Promise.all([
    uploadFileToS3(
      callerAudioPath,
      `audio/${callId}-caller.mp3`,
      "audio/mpeg",
      true, // Always use signed URLs for external API access
    ),
    uploadFileToS3(
      targetAudioPath,
      `audio/${callId}-target.mp3`,
      "audio/mpeg",
      true, // Always use signed URLs for external API access
    ),
  ]);

  console.log(`[Audio Split] ✅ Split and uploaded audio to S3`);

  return {
    callerAudioPath,
    targetAudioPath,
    callerS3Url,
    targetS3Url,
  };
}

/**
 * Validate that input file is a valid audio file
 */
export async function validateAudioFile(
  filePath: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (error: Error | null) => {
      if (error) {
        console.error(`[Audio Validation] Invalid audio file: ${error.message}`);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

