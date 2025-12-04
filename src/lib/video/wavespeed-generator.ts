/**
 * WavespeedAI infinitetalk-fast multi video generation integration
 * 
 * Converts image + audio into dual-person talking avatar videos
 * https://wavespeed.ai/models/infinitetalk-fast/multi
 * 
 * Image layout: 16:9 LANDSCAPE with LEFT = caller (AI), RIGHT = target
 * Audio mapping:
 * - left_audio  → LEFT person (caller/AI)
 * - right_audio → RIGHT person (target)
 * 
 * After video generation, we rotate the output:
 * LEFT→TOP, RIGHT→BOTTOM for final 9:16 portrait output
 */

import { env } from "~/env/server";
import { retryWithBackoff } from "~/lib/utils/retry";

const WAVESPEED_API_BASE = "https://api.wavespeed.ai/api/v3";
const MODEL_ENDPOINT = `${WAVESPEED_API_BASE}/wavespeed-ai/infinitetalk-fast/multi`;

export interface WavespeedVideoResult {
  videoUrl: string;
  jobId: string;
  status: "pending" | "generating" | "completed" | "failed";
  cost?: number; // Cost in USD
  duration?: number; // Duration in seconds
}



/**
 * Submit multi-person video generation job to WavespeedAI
 * 
 * WavespeedAI mapping for horizontal (LEFT/RIGHT) images:
 * - left_audio  → LEFT person (caller/AI)
 * - right_audio → RIGHT person (target)
 */
async function submitWavespeedMultiJob(
  leftAudioUrl: string,   // → LEFT person (caller/AI)
  rightAudioUrl: string,  // → RIGHT person (target)
  imageUrl: string,
  seed: number = -1,
): Promise<string> {
  if (!env.WAVESPEED_API_KEY) {
    throw new Error(
      "WavespeedAI API key not configured. Please set WAVESPEED_API_KEY environment variable",
    );
  }

  const response = await fetch(MODEL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.WAVESPEED_API_KEY}`,
    },
    body: JSON.stringify({
      left_audio: leftAudioUrl,    // → LEFT person (caller/AI)
      right_audio: rightAudioUrl,  // → RIGHT person (target)
      image: imageUrl,
      order: "meanwhile",
      seed: seed,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `WavespeedAI API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const result = await response.json();
  if (result.code !== 200) {
    throw new Error(`WavespeedAI API error: ${result.message || "Unknown error"}`);
  }

  return result.data.id;
}

/**
 * Calculate cost from audio duration (seconds)
 * Pricing: $0.015 per second of audio input (not inference time)
 * This matches WavespeedAI's actual billing model
 */
function calculateCostFromAudioDuration(audioDurationSeconds: number): number {
  // Minimum billing: 5 seconds
  const billedDuration = Math.max(5, audioDurationSeconds);
  // Cap at maximum: 600 seconds
  const cappedDuration = Math.min(600, billedDuration);
  return cappedDuration * 0.015;
}

/**
 * Poll for job completion
 */
async function pollWavespeedJob(jobId: string): Promise<WavespeedVideoResult> {
  const resultUrl = `${WAVESPEED_API_BASE}/predictions/${jobId}/result`;

  let lastStatus = "";
  const startTime = Date.now();
  let pollCount = 0;

  while (true) {
    const response = await fetch(resultUrl, {
      headers: {
        Authorization: `Bearer ${env.WAVESPEED_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `WavespeedAI polling error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();
    const data = result.data;

    if (data.status === "completed") {
      const videoUrl = data.outputs?.[0];
      if (!videoUrl) {
        throw new Error("WavespeedAI completed but no video URL in response");
      }

      // Extract inference time from API response (for logging only)
      const inferenceTimeMs = data.timings?.inference || 0;
      const inferenceTimeSeconds = inferenceTimeMs / 1000;

      // Extract cost from API response (use absolute value if negative)
      const apiCost = data.cost !== undefined ? Math.abs(data.cost) : undefined;

      // Clear the progress line before logging completion
      if (pollCount > 0) {
        process.stdout.write("\r" + " ".repeat(80) + "\r");
      }

      if (apiCost !== undefined) {
        console.log(
          `[WavespeedAI] Inference: ${inferenceTimeSeconds.toFixed(1)}s | Cost: $${apiCost.toFixed(4)}`,
        );
      } else {
        console.log(`[WavespeedAI] Inference: ${inferenceTimeSeconds.toFixed(1)}s`);
      }

      return {
        videoUrl,
        jobId,
        status: "completed",
        duration: inferenceTimeSeconds,
        cost: apiCost, // Use API cost if available, otherwise will be calculated from audio duration
      };
    } else if (data.status === "failed") {
      throw new Error(
        `WavespeedAI job failed: ${data.error || "Unknown error"}`,
      );
    }

    // Log status changes
    if (data.status !== lastStatus) {
      if (pollCount > 0) {
        process.stdout.write("\r" + " ".repeat(80) + "\r");
      }
      console.log(`[WavespeedAI] Status: ${data.status}`);
      lastStatus = data.status;
    }

    // Show progress every 10 seconds
    pollCount++;
    if (pollCount % 20 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      process.stdout.write(`\r[WavespeedAI] Processing... ${elapsed.toFixed(0)}s`);
    }

    // Wait before polling again (500ms as per API example)
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Generate multi-person video using WavespeedAI infinitetalk-fast/multi
 * 
 * Image layout: 16:9 LANDSCAPE with LEFT = caller (AI), RIGHT = target
 * 
 * WavespeedAI mapping:
 * - left_audio  → LEFT person (caller/AI)
 * - right_audio → RIGHT person (target)
 * 
 * After generation, call rotateVideoToPortrait() to convert LEFT→TOP, RIGHT→BOTTOM
 */
export async function generateMultiPersonVideo(
  leftAudioUrl: string,   // Caller (AI) audio → left_audio → LEFT
  rightAudioUrl: string,  // Target (person) audio → right_audio → RIGHT
  callId: string,
  imageUrl: string,
  audioDuration?: number,
): Promise<WavespeedVideoResult> {
  if (!env.WAVESPEED_API_KEY) {
    throw new Error(
      "WavespeedAI API key not configured. Please set WAVESPEED_API_KEY environment variable",
    );
  }

  // Fail loudly if image URL is missing - no fallbacks during development
  if (!imageUrl) {
    throw new Error(
      `[WavespeedAI] ❌ Missing required imageUrl for call ${callId}. Image generation must succeed before video generation.`,
    );
  }

  const finalImageUrl = imageUrl;

  console.log(`[WavespeedAI] Generating multi-person video for call ${callId}`);

  // Submit job with retry
  // leftAudioUrl → left_audio → LEFT person (caller/AI)
  // rightAudioUrl → right_audio → RIGHT person (target)
  const jobId = await retryWithBackoff(
    () => submitWavespeedMultiJob(leftAudioUrl, rightAudioUrl, finalImageUrl),
    { maxRetries: 2, initialDelay: 1000 },
  );

  console.log(`[WavespeedAI] Job submitted: ${jobId.substring(0, 8)}...`);

  // Poll for completion with retry
  const result = await retryWithBackoff(
    () => pollWavespeedJob(jobId),
    { maxRetries: 3, initialDelay: 2000 },
  );

  // Use API cost if available, otherwise calculate from audio duration
  const finalCost = result.cost !== undefined 
    ? result.cost 
    : (audioDuration ? calculateCostFromAudioDuration(audioDuration) : undefined);
  
  console.log(`[WavespeedAI] ✅ Video generated`);

  return {
    ...result,
    cost: finalCost,
  };
}

/**
 * Download video from WavespeedAI URL
 * WavespeedAI videos already include audio, so we don't need to add it
 */
export async function downloadWavespeedVideo(
  videoUrl: string,
  callId: string,
): Promise<string> {
  const response = await retryWithBackoff(
    async () => {
      const res = await fetch(videoUrl);
      if (!res.ok) {
        throw new Error(`Failed to download video: ${res.status} ${res.statusText}`);
      }
      return res;
    },
    { maxRetries: 3, initialDelay: 1000 },
  );

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Save to temp file
  const fs = await import("fs/promises");
  const { getTempFilePath } = await import("~/lib/utils/temp-cleanup");

  const tempPath = getTempFilePath(callId, "video", "mp4");
  await fs.writeFile(tempPath, buffer);

  console.log(`[WavespeedAI] ✅ Downloaded video (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);

  return tempPath;
}

/**
 * Rotate a 16:9 landscape video to 9:16 portrait
 * 
 * Takes a side-by-side video (LEFT | RIGHT) and converts it to
 * a stacked video (TOP / BOTTOM) where LEFT→TOP and RIGHT→BOTTOM
 * 
 * Input: 16:9 landscape (e.g., 1920x1080) with LEFT=caller, RIGHT=target
 * Output: 9:16 portrait (e.g., 1080x1920) with TOP=caller, BOTTOM=target
 */
export async function rotateVideoToPortrait(
  inputPath: string,
  callId: string,
): Promise<string> {
  const ffmpeg = (await import("fluent-ffmpeg")).default;
  const { getTempFilePath } = await import("~/lib/utils/temp-cleanup");
  
  const outputPath = getTempFilePath(callId, "video-portrait", "mp4");
  
  console.log(`[WavespeedAI] 🔄 Rotating video to portrait (LEFT→TOP, RIGHT→BOTTOM)`);
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      // Use filter_complex to:
      // 1. Split input into two streams
      // 2. Crop left half from first stream
      // 3. Crop right half from second stream
      // 4. Stack them vertically (left on top, right on bottom)
      .complexFilter([
        // Split the input
        '[0:v]split=2[left][right]',
        // Crop left half (caller) - from x=0, width=half
        '[left]crop=iw/2:ih:0:0[top]',
        // Crop right half (target) - from x=half, width=half
        '[right]crop=iw/2:ih:iw/2:0[bottom]',
        // Stack vertically: top (left/caller) over bottom (right/target)
        '[top][bottom]vstack=inputs=2[v]'
      ])
      .outputOptions([
        '-map', '[v]',
        '-map', '0:a', // Keep audio
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
      ])
      .output(outputPath)
      .on('end', () => {
        console.log(`[WavespeedAI] ✅ Rotated to portrait`);
        resolve(outputPath);
      })
      .on('error', (err: Error) => {
        console.error(`[WavespeedAI] ❌ Rotation failed:`, err);
        reject(err);
      })
      .run();
  });
}

