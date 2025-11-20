import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "~/env/server";
import { calls } from "~/lib/db/schema/calls";
import * as schema from "~/lib/db/schema";
import { getBoss, JOB_TYPES } from "~/lib/queue/boss";
import { generateVideoFromAudio } from "~/lib/video/generator";
import { uploadAudioToS3, uploadVideoToS3 } from "~/lib/storage/s3";
interface GenerateVideoJob {
  callId: string;
  recordingUrl?: string; // Twilio recording URL (fallback)
  audioBuffer?: Buffer; // Processed audio from stream (preferred)
}

export async function setupVideoGeneratorWorker() {
  const boss = await getBoss();

  // Queue is created in getBoss(), so we can start worker directly
  await boss.work<GenerateVideoJob>(
    JOB_TYPES.GENERATE_VIDEO,
    async ([job]) => {
      if (!job) return;
      
      const { callId, recordingUrl, audioBuffer } = job.data;

      console.log(`[Video Generator] Processing video for call ${callId}`);

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

        // Update video status to "generating"
        await db
          .update(calls)
          .set({
            videoStatus: "generating",
            updatedAt: new Date(),
          })
          .where(eq(calls.id, callId));

        let audioUrl: string;

        if (audioBuffer) {
          // Use processed audio from stream
          audioUrl = await uploadAudioToS3(audioBuffer, callId);
        } else if (recordingUrl) {
          // Download recording from Twilio and upload to S3
          // TODO: Download from Twilio recording URL
          // For now, use recording URL directly if it's accessible
          audioUrl = recordingUrl;
        } else {
          throw new Error("No audio source available for video generation");
        }

        // Generate video from audio
        const videoResult = await generateVideoFromAudio({
          audioUrl,
          callId,
        });

        // Download video and upload to S3
        // TODO: Download video from fal.ai result URL
        // For now, placeholder
        const videoUrl = await uploadVideoToS3(
          Buffer.from("mock video data"),
          callId,
        );

        // Update call with video URL and status
        await db
          .update(calls)
          .set({
            videoUrl,
            videoStatus: "completed",
            falJobId: videoResult.jobId,
            updatedAt: new Date(),
          })
          .where(eq(calls.id, callId));

        console.log(`[Video Generator] Completed video for call ${callId}`);
      } catch (error) {
        console.error(`[Video Generator] Error processing video ${callId}:`, error);

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
      } finally {
        await driver.end();
      }
    },
  );

  console.log(`[Video Generator] Worker started for job type: ${JOB_TYPES.GENERATE_VIDEO}`);
}

