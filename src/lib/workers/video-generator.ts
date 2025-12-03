import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "~/env/server";
import { calls } from "~/lib/db/schema/calls";
import { user } from "~/lib/db/schema/auth.schema";
import { getBoss, JOB_TYPES } from "~/lib/queue/boss";
import { downloadTwilioRecording } from "~/lib/twilio/recording";
import { splitStereoAudio } from "~/lib/audio/split-channels";
import {
  generateMultiPersonVideo,
  downloadWavespeedVideo,
} from "~/lib/video/wavespeed-generator";
import { generateImage } from "~/lib/image/wavespeed-image-generator";
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
      const db = drizzle({ client: driver, casing: "snake_case" });

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

        // Generate image prompt using Groq (only if not already generated)
        // This happens AFTER call completes, so we can generate it now
        let imagePrompt = call.imagePrompt;
        
        if (!imagePrompt) {
          const { generateImagePrompt } = await import("~/lib/prompts/groq-generator");
          
          // Fail loudly if required fields are missing
          if (!call.targetGender) {
            throw new Error(`[Video Generator] ❌ Missing required field: targetGender for call ${callId}`);
          }
          if (!call.videoStyle) {
            throw new Error(`[Video Generator] ❌ Missing required field: videoStyle for call ${callId}`);
          }
          
          const promptInput = {
            targetPerson: {
              name: call.recipientName,
              gender: call.targetGender as "male" | "female" | "other",
              genderCustom: call.targetGenderCustom || undefined,
              ageRange: call.targetAgeRange || undefined,
              physicalDescription: call.targetPhysicalDescription || undefined,
              city: call.targetCity || undefined,
              hobby: call.targetHobby || undefined,
              profession: call.targetProfession || undefined,
              interestingPiece: call.interestingPiece || undefined,
              ragebaitTrigger: call.ragebaitTrigger || undefined,
            },
            videoStyle: call.videoStyle,
            anythingElse: call.anythingElse || undefined,
          };
          
          // Fail loudly if generation fails - no fallbacks during development
          imagePrompt = await generateImagePrompt(promptInput);
          console.log(`[Video Generator] ✅ Generated image prompt`);
          
          // Store the generated prompt in database
          await db
            .update(calls)
            .set({
              imagePrompt,
              updatedAt: new Date(),
            })
            .where(eq(calls.id, callId));
        }

        // Generate image - either edit user's uploaded image or generate from scratch
        let finalImageUrl: string;
        
        if (call.uploadedImageUrl) {
          // User uploaded an image - use WaveSpeed edit API to place them in scene
          console.log(`[Video Generator] 📸 Using uploaded image for call ${callId}`);
          const { editImageWithWavespeed } = await import("~/lib/image/wavespeed-image-generator");
          const editResult = await editImageWithWavespeed({
            sourceImageUrl: call.uploadedImageUrl,
            prompt: imagePrompt, // Use generated prompt to describe the scene
            callId,
          });
          finalImageUrl = editResult.url;
        } else {
          // No uploaded image - generate from scratch using WavespeedAI nano-banana-pro
          const imageResult = await generateImage({
            prompt: imagePrompt,
            callId,
          });
          finalImageUrl = imageResult.imageUrl;
        }

        // Generate multi-person video with WavespeedAI using the image
        const videoResult = await generateMultiPersonVideo(
          callerS3Url,
          calleeS3Url,
          callId,
          finalImageUrl, // Use either edited or generated image
          audioDuration,
        );

        // Download video from WavespeedAI
        const videoPath = await downloadWavespeedVideo(
          videoResult.videoUrl,
          callId,
        );
        tempFiles.push(videoPath);

        // Upload final video to S3
        const videoS3Key = `videos/${callId}.mp4`;
        const finalVideoUrl = await uploadFileToS3(
          videoPath,
          videoS3Key,
          "video/mp4",
        );

        // Get user email for notification
        const [userRecord] = await db
          .select()
          .from(user)
          .where(eq(user.id, call.userId))
          .limit(1);

        // Update database with both URL and S3 key (key is used for generating fresh URLs)
        await db
          .update(calls)
          .set({
            videoUrl: finalVideoUrl,
            videoS3Key: videoS3Key, // Store S3 key for generating fresh presigned URLs
            videoStatus: "completed",
            wavespeedJobId: videoResult.jobId,
            updatedAt: new Date(),
          })
          .where(eq(calls.id, callId));

        console.log(`[Video Generator] ✅ Completed video generation for call ${callId}`);

        // Send email notification if user email is available
        if (userRecord?.email) {
          try {
            const { sendVideoReadyEmail } = await import("~/lib/email/resend");
            const dashboardUrl = `${env.VITE_BASE_URL}/dashboard`;
            await sendVideoReadyEmail(
              userRecord.email,
              userRecord.name || "User",
              finalVideoUrl,
              dashboardUrl,
            );
            console.log(`[Video Generator] ✅ Sent email notification to ${userRecord.email}`);
          } catch (error) {
            console.error(`[Video Generator] ❌ Failed to send email:`, error);
            // Don't fail the whole job if email fails
          }
        }
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

