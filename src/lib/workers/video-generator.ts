import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "~/env/server";
import { calls } from "~/lib/db/schema/calls";
import * as schema from "~/lib/db/schema";
import { getBoss, JOB_TYPES } from "~/lib/queue/boss";
import { downloadTwilioRecording } from "~/lib/twilio/recording";
import { splitStereoAudio } from "~/lib/audio/split-channels";
import {
  generateMultiPersonVideo,
  downloadWavespeedVideo,
} from "~/lib/video/wavespeed-generator";
import {
  generateImage,
  getDefaultCallImagePrompt,
} from "~/lib/image/wavespeed-image-generator";
import { uploadFileToS3 } from "~/lib/storage/s3";
import {
  cleanupTempFiles,
  cleanupTempFilesByCallId,
  getTempFilePath,
} from "~/lib/utils/temp-cleanup";
import ffmpeg from "fluent-ffmpeg";

interface GenerateVideoJob {
  callId: string;
  recordingUrl?: string; // Twilio recording URL
}

export async function setupVideoGeneratorWorker() {
  const boss = await getBoss();

  // Queue is created in getBoss(), so we can start worker directly
  await boss.work<GenerateVideoJob>(
    JOB_TYPES.GENERATE_VIDEO,
    async ([job]) => {
      if (!job) return;
      
      const { callId, recordingUrl } = job.data;

      console.log(`[Video Generator] 🎬 Starting video generation for call ${callId}`);

      // Track temp files for cleanup
      const tempFiles: string[] = [];

      // Create database connection
      const driver = postgres(env.DATABASE_URL);
      const db = drizzle({ client: driver, schema, casing: "snake_case" });

      try {
        // Fetch call record
        const [call] = await db
          .select()
          .from(calls)
          .where(eq(calls.id, callId))
          .limit(1);

        if (!call) {
          throw new Error(`Call ${callId} not found`);
        }

        if (!recordingUrl && !call.recordingUrl) {
          throw new Error("No recording URL available for video generation");
        }

        const twilioRecordingUrl = recordingUrl || call.recordingUrl!;

        // Update status to "generating"
        await db
          .update(calls)
          .set({
            videoStatus: "generating",
            updatedAt: new Date(),
          })
          .where(eq(calls.id, callId));

        // Download recording from Twilio
        const recordingBuffer = await downloadTwilioRecording({
          recordingUrl: twilioRecordingUrl,
          callId,
        });

        // Save recording to temp file
        const tempRecordingPath = getTempFilePath(callId, "recording", "mp3");
        const fs = await import("fs/promises");
        await fs.writeFile(tempRecordingPath, recordingBuffer);
        tempFiles.push(tempRecordingPath);

        // Split stereo audio and upload to S3
        const { callerS3Url, calleeS3Url } = await splitStereoAudio(
          tempRecordingPath,
          callId,
        );
        tempFiles.push(
          getTempFilePath(callId, "caller", "mp3"),
          getTempFilePath(callId, "callee", "mp3"),
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

        // Generate image from prompt using WavespeedAI nano-banana-pro
        const imagePrompt = getDefaultCallImagePrompt();
        const imageResult = await generateImage({
          prompt: imagePrompt,
          callId,
          aspectRatio: "16:9",
          resolution: "1k",
          outputFormat: "png",
        });

        // Generate multi-person video with WavespeedAI using the generated image
        const videoResult = await generateMultiPersonVideo(
          callerS3Url,
          calleeS3Url,
          callId,
          imageResult.imageUrl, // Use generated image
          audioDuration,
        );

        // Download video from WavespeedAI
        const videoPath = await downloadWavespeedVideo(
          videoResult.videoUrl,
          callId,
        );
        tempFiles.push(videoPath);

        // Upload final video to S3
        const finalVideoUrl = await uploadFileToS3(
          videoPath,
          `videos/${callId}.mp4`,
          "video/mp4",
        );

        // Update database
        await db
          .update(calls)
          .set({
            videoUrl: finalVideoUrl,
            videoStatus: "completed",
            wavespeedJobId: videoResult.jobId,
            updatedAt: new Date(),
          })
          .where(eq(calls.id, callId));

        console.log(`[Video Generator] ✅ Completed video generation for call ${callId}`);
      } catch (error) {
        console.error(`[Video Generator] ❌ Error processing video ${callId}:`, error);

        // Update call with error status
        await db
          .update(calls)
          .set({
            videoStatus: "failed",
            videoErrorMessage:
              error instanceof Error ? error.message : "Unknown error",
            updatedAt: new Date(),
          })
          .where(eq(calls.id, callId));

        // Clean up temp files
        await cleanupTempFilesByCallId(callId).catch(() => {});
      } finally {
        // Clean up tracked temp files
        await cleanupTempFiles(tempFiles).catch(() => {});
        await cleanupTempFilesByCallId(callId).catch(() => {});

        await driver.end();
      }
    },
  );

  console.log(`[Video Generator] Worker started for job type: ${JOB_TYPES.GENERATE_VIDEO}`);
}

