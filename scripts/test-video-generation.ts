/**
 * Test script for video generation pipeline
 * 
 * Usage: bun run scripts/test-video-generation.ts
 */

import { downloadTwilioRecording } from "~/lib/twilio/recording";
import { splitStereoAudio } from "~/lib/audio/split-channels";
import {
  generateMultiPersonVideo,
  downloadWavespeedVideo,
} from "~/lib/video/wavespeed-generator";
import { uploadFileToS3 } from "~/lib/storage/s3";
import { cleanupTempFiles, getTempFilePath } from "~/lib/utils/temp-cleanup";
import { getTwilioClient } from "~/lib/twilio/client";
import ffmpeg from "fluent-ffmpeg";

const CALL_SID = "CAff219b5c24d3d3af001e35535c9cee8d";
const TEST_CALL_ID = "test-video-generation";

async function testVideoGeneration() {
  console.log("=".repeat(80));
  console.log("🧪 Testing Video Generation Pipeline");
  console.log("=".repeat(80));

  const tempFiles: string[] = [];
  let cleanupDone = false;

  const cleanup = async () => {
    if (cleanupDone) return;
    cleanupDone = true;
    await cleanupTempFiles(tempFiles).catch(() => {});
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("SIGHUP", cleanup);

  try {
    // Get recording URL from Twilio
    const twilioClient = getTwilioClient();
    
    if (!twilioClient) {
      throw new Error("Twilio client not configured");
    }

    const recordings = await twilioClient.recordings.list({
      callSid: CALL_SID,
      limit: 1,
    });

    if (recordings.length === 0) {
      throw new Error(`No recordings found for call ${CALL_SID}`);
    }

    const recording = recordings[0];
    const recordingUrl = `https://api.twilio.com${recording.uri.replace(".json", "")}`;

    // Download recording from Twilio
    const recordingBuffer = await downloadTwilioRecording({
      recordingUrl,
      callId: TEST_CALL_ID,
    });

    // Save recording to temp file
    const tempRecordingPath = getTempFilePath(TEST_CALL_ID, "recording", "mp3");
    const fs = await import("fs/promises");
    await fs.writeFile(tempRecordingPath, recordingBuffer);
    tempFiles.push(tempRecordingPath);

    // Split stereo audio and upload to S3
    const { callerS3Url, calleeS3Url } = await splitStereoAudio(
      tempRecordingPath,
      TEST_CALL_ID,
    );
    tempFiles.push(
      getTempFilePath(TEST_CALL_ID, "caller", "mp3"),
      getTempFilePath(TEST_CALL_ID, "callee", "mp3"),
    );

    // Get audio duration for cost calculation
    const audioDuration = await new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(tempRecordingPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });

    // Generate multi-person video with WavespeedAI
    console.log(`[Test] Generating video (this may take 2-5 minutes)...`);
    const videoResult = await generateMultiPersonVideo(
      callerS3Url,
      calleeS3Url,
      TEST_CALL_ID,
      undefined, // Use default image
      audioDuration,
    );

    // Download video from WavespeedAI
    const videoPath = await downloadWavespeedVideo(
      videoResult.videoUrl,
      TEST_CALL_ID,
    );
    tempFiles.push(videoPath);

    // Upload final video to S3
    const finalVideoUrl = await uploadFileToS3(
      videoPath,
      `videos/${TEST_CALL_ID}.mp4`,
      "video/mp4",
    );

    console.log("\n" + "=".repeat(80));
    console.log("✅ TEST COMPLETE!");
    console.log("=".repeat(80));
    console.log(`Video URL: ${finalVideoUrl}`);
    console.log("=".repeat(80));

  } catch (error) {
    console.error("\n" + "=".repeat(80));
    console.error("❌ TEST FAILED");
    console.error("=".repeat(80));
    console.error(error);
    console.error("=".repeat(80));
    throw error;
  } finally {
    if (!cleanupDone) {
      await cleanupTempFiles(tempFiles).catch(() => {});
      cleanupDone = true;
    }
  }
}

// Run the test
testVideoGeneration().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
