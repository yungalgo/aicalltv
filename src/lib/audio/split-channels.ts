/**
 * Audio processing utilities for splitting stereo audio
 */

import ffmpeg from "fluent-ffmpeg";
import { getTempFilePath } from "~/lib/utils/temp-cleanup";
import { uploadFileToS3 } from "~/lib/storage/s3";
import { retryWithBackoff } from "~/lib/utils/retry";

export interface SplitAudioResult {
  callerAudioPath: string; // Local temp file path
  calleeAudioPath: string; // Local temp file path
  callerS3Url: string; // S3 URL for caller audio
  calleeS3Url: string; // S3 URL for callee audio
}

/**
 * Split stereo audio file into left (caller) and right (callee) channels
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
  const calleeAudioPath = getTempFilePath(callId, "callee", "mp3");

  console.log(`[Audio Split] Splitting stereo audio for call ${callId}`);

  // Extract left channel (caller) as mono with 1 second silence prepended
  // The stereo file tells us left=caller, right=callee
  // We use adelay filter to delay audio by 1 second (prepends silence)
  await retryWithBackoff(
    () =>
      new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .audioFilters([
            "pan=mono|c0=FL", // Extract left channel (caller) as mono
            "adelay=1000" // Delay by 1000ms (1 second) - prepends silence
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

  // Extract right channel (callee) as mono with 1 second silence prepended
  // The stereo file tells us left=caller, right=callee
  // We use adelay filter to delay audio by 1 second (prepends silence)
  await retryWithBackoff(
    () =>
      new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .audioFilters([
            "pan=mono|c0=FR", // Extract right channel (callee) as mono
            "adelay=1000" // Delay by 1000ms (1 second) - prepends silence
          ])
          .output(calleeAudioPath)
          .on("end", () => {
            resolve();
          })
          .on("error", (error: Error) => {
            console.error(`[Audio Split] ❌ Error extracting callee audio:`, error);
            reject(error);
          })
          .run();
      }),
    { maxRetries: 2, initialDelay: 1000 },
  );

  // Upload both channels to S3 for WavespeedAI multi model
  const [callerS3Url, calleeS3Url] = await Promise.all([
    uploadFileToS3(
      callerAudioPath,
      `audio/${callId}-caller.mp3`,
      "audio/mpeg",
      true, // Always use signed URLs for external API access
    ),
    uploadFileToS3(
      calleeAudioPath,
      `audio/${callId}-callee.mp3`,
      "audio/mpeg",
      true, // Always use signed URLs for external API access
    ),
  ]);

  console.log(`[Audio Split] ✅ Split and uploaded audio to S3`);

  return {
    callerAudioPath,
    calleeAudioPath,
    callerS3Url,
    calleeS3Url,
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

