/**
 * WavespeedAI nano-banana-pro image generation integration
 * 
 * Generates images from prompts using Google's nano-banana-pro model
 * https://wavespeed.ai/models/google/nano-banana-pro
 * 
 * Image format: 9:16 vertical portrait
 * Layout: TOP = caller (AI), BOTTOM = target (person being called)
 */

import { env } from "~/env/server";
import { retryWithBackoff } from "~/lib/utils/retry";
import { uploadToS3, getSignedS3Url } from "~/lib/storage/s3";

const WAVESPEED_API_BASE = "https://api.wavespeed.ai/api/v3";
const MODEL_ENDPOINT = `${WAVESPEED_API_BASE}/google/nano-banana-pro/text-to-image`;

export interface WavespeedImageResult {
  imageUrl: string;
  requestId: string;
  status: "completed";
  s3Key?: string; // S3 key where image is stored
}

export interface GenerateImageOptions {
  prompt: string;
  callId: string;
}

/**
 * Submit image generation job to WavespeedAI nano-banana-pro
 * Always uses: PNG format, 9:16 aspect ratio (vertical), 4k resolution
 * Layout: TOP = caller (AI), BOTTOM = target (person)
 */
async function submitImageGenerationJob(
  prompt: string,
): Promise<string> {
  if (!env.WAVESPEED_API_KEY) {
    throw new Error(
      "WavespeedAI API key not configured. Please set WAVESPEED_API_KEY environment variable",
    );
  }

  const payload = {
    prompt: prompt,
    resolution: "4k",
    aspect_ratio: "9:16", // Vertical portrait - TOP=caller, BOTTOM=target
    output_format: "png",
    enable_sync_mode: false,
    enable_base64_output: false,
    num_images: 1
  };

  const response = await fetch(MODEL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.WAVESPEED_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `WavespeedAI image API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const result = await response.json();
  const requestId = result.data?.id;

  if (!requestId) {
    throw new Error(
      `WavespeedAI image API error: No request ID in response - ${JSON.stringify(result)}`,
    );
  }

  return requestId;
}

/**
 * Poll for image generation completion
 */
async function pollImageGeneration(
  requestId: string,
): Promise<string> {
  const resultUrl = `${WAVESPEED_API_BASE}/predictions/${requestId}/result`;

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
        `WavespeedAI image polling error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();
    const data = result.data;

    if (data.status === "completed") {
      const imageUrl = data.outputs?.[0];
      if (!imageUrl) {
        throw new Error("WavespeedAI image completed but no image URL in response");
      }

      const pollDuration = (Date.now() - startTime) / 1000;

      // Clear the progress line before logging completion
      if (pollCount > 0) {
        process.stdout.write("\r" + " ".repeat(80) + "\r");
      }

      console.log(`[WavespeedAI Image] ✅ Generated in ${pollDuration.toFixed(1)}s`);

      return imageUrl;
    } else if (data.status === "failed") {
      throw new Error(
        `WavespeedAI image job failed: ${data.error || "Unknown error"}`,
      );
    }

    // Log status changes
    if (data.status !== lastStatus) {
      if (pollCount > 0) {
        process.stdout.write("\r" + " ".repeat(80) + "\r");
      }
      console.log(`[WavespeedAI Image] Status: ${data.status}`);
      lastStatus = data.status;
    }

    // Show progress every 2 seconds
    pollCount++;
    if (pollCount % 20 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      process.stdout.write(`\r[WavespeedAI Image] Processing... ${elapsed.toFixed(0)}s`);
    }

    // Wait before polling again (100ms as per API example)
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * Download image from WavespeedAI URL and upload to S3
 * Always stores as PNG
 */
async function downloadAndStoreImage(
  imageUrl: string,
  callId: string,
): Promise<{ url: string; key: string }> {
  // Download image from WavespeedAI
  const response = await retryWithBackoff(
    async () => {
      const res = await fetch(imageUrl);
      if (!res.ok) {
        throw new Error(`Failed to download image: ${res.status} ${res.statusText}`);
      }
      return res;
    },
    { maxRetries: 3, initialDelay: 1000 },
  );

  const arrayBuffer = await response.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  // Upload to S3 (always PNG)
  const s3Key = `images/${callId}.png`;
  const contentType = "image/png";

  const result = await uploadToS3({
    file: imageBuffer,
    key: s3Key,
    contentType,
  });

  // Generate signed URL for WavespeedAI video generation (24 hour expiry)
  // WavespeedAI needs to access this URL, so we use signed URLs
  const signedUrl = await getSignedS3Url(result.key, 86400, result.bucket); // 24 hours

  console.log(
    `[WavespeedAI Image] ✅ Stored image (${(imageBuffer.length / 1024).toFixed(1)}KB) at ${s3Key}`,
  );

  return {
    url: signedUrl,
    key: s3Key,
  };
}

/**
 * Generate image from prompt using WavespeedAI nano-banana-pro
 * Downloads the generated image and stores it in S3, returning a signed URL
 */
export async function generateImage(
  options: GenerateImageOptions,
): Promise<WavespeedImageResult> {
  if (!env.WAVESPEED_API_KEY) {
    throw new Error(
      "WavespeedAI API key not configured. Please set WAVESPEED_API_KEY environment variable",
    );
  }

  const { prompt, callId } = options;

  console.log(`[WavespeedAI Image] 🎨 Generating image for call ${callId} (PNG, 9:16 vertical, 4k)`);

  // Submit job with retry (always PNG, 16:9, 4k)
  const requestId = await retryWithBackoff(
    () => submitImageGenerationJob(prompt),
    { maxRetries: 2, initialDelay: 1000 },
  );

  console.log(`[WavespeedAI Image] Job submitted: ${requestId.substring(0, 8)}...`);

  // Poll for completion with retry
  const wavespeedImageUrl = await retryWithBackoff(
    () => pollImageGeneration(requestId),
    { maxRetries: 3, initialDelay: 2000 },
  );

  // Download and store in S3 (always PNG)
  const { url: s3Url, key: s3Key } = await downloadAndStoreImage(
    wavespeedImageUrl,
    callId,
  );

  console.log(`[WavespeedAI Image] ✅ Image generated and stored`);

  return {
    imageUrl: s3Url,
    requestId,
    status: "completed",
    s3Key,
  };
}

/**
 * Default prompt for split-screen call scenes (9:16 vertical)
 * TOP = AI caller, BOTTOM = target person
 * 
 * NOTE: This is ONLY used in test scripts (scripts/test-video-generation.ts)
 * Production uses Groq-generated prompts from groq-generator.ts
 */
export function getDefaultCallImagePrompt(): string {
  return (
    "Vertical split-screen shot (9:16 portrait) of two characters actively on a phone call. " +
    "TOP half: a quirky AI caller character with exaggerated features, phone pressed to ear, mouth open mid-sentence, animated talking expression. " +
    "BOTTOM half: the target person on the phone call, phone held to ear, mouth open responding, engaged conversation expression. " +
    "IMPORTANT: Both characters must be ACTIVELY SPEAKING into phones with mouths open, not just holding phones."
  );
}

// WaveSpeed Edit API for user-uploaded images
const EDIT_MODEL_ENDPOINT = `${WAVESPEED_API_BASE}/google/nano-banana-pro/edit`;

export interface EditImageOptions {
  sourceImageUrl: string;
  prompt: string;
  callId: string;
}

/**
 * Submit image edit job to WavespeedAI nano-banana-pro/edit
 * Takes a user's uploaded photo and edits it into a phone call scene
 * Layout: 9:16 vertical - TOP = caller (AI), BOTTOM = target (person from photo)
 */
async function submitImageEditJob(
  sourceImageUrl: string,
  prompt: string,
): Promise<string> {
  if (!env.WAVESPEED_API_KEY) {
    throw new Error(
      "WavespeedAI API key not configured. Please set WAVESPEED_API_KEY environment variable",
    );
  }

  // Edit prompt: use the Groq-generated prompt but add instructions to preserve the uploaded person's likeness
  // The prompt already contains: caller description, target description, style, and layout
  // We just need to add the instruction to use the uploaded photo for the BOTTOM half
  const editPrompt = `${prompt}

IMPORTANT EDIT INSTRUCTION: Use the uploaded photo as reference for the BOTTOM half character. 
Preserve their face, likeness, and identity while rendering them in the specified art style.
Both characters must be ACTIVELY SPEAKING on phones with mouths open.`;

  const payload = {
    prompt: editPrompt,
    images: [sourceImageUrl], // Array of image URLs
    resolution: "4k",
    aspect_ratio: "9:16", // Vertical portrait - TOP=caller, BOTTOM=target
    output_format: "png",
    enable_sync_mode: false,
    enable_base64_output: false,
  };

  const response = await fetch(EDIT_MODEL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.WAVESPEED_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `WavespeedAI edit API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const result = await response.json();
  const requestId = result.data?.id;

  if (!requestId) {
    throw new Error(
      `WavespeedAI edit API error: No request ID in response - ${JSON.stringify(result)}`,
    );
  }

  return requestId;
}

/**
 * Edit a user-uploaded image using WavespeedAI nano-banana-pro/edit
 * Transforms the uploaded photo into a phone call scene
 */
export async function editImageWithWavespeed(
  options: EditImageOptions,
): Promise<{ url: string; key: string }> {
  if (!env.WAVESPEED_API_KEY) {
    throw new Error(
      "WavespeedAI API key not configured. Please set WAVESPEED_API_KEY environment variable",
    );
  }

  const { sourceImageUrl, prompt, callId } = options;

  console.log(`[WavespeedAI Edit] 🎨 Editing uploaded image for call ${callId}`);

  // Submit edit job with retry
  const requestId = await retryWithBackoff(
    () => submitImageEditJob(sourceImageUrl, prompt),
    { maxRetries: 2, initialDelay: 1000 },
  );

  console.log(`[WavespeedAI Edit] Job submitted: ${requestId.substring(0, 8)}...`);

  // Poll for completion (reuse existing polling function)
  const wavespeedImageUrl = await retryWithBackoff(
    () => pollImageGeneration(requestId),
    { maxRetries: 3, initialDelay: 2000 },
  );

  // Download and store in S3
  const { url: s3Url, key: s3Key } = await downloadAndStoreImage(
    wavespeedImageUrl,
    callId,
  );

  console.log(`[WavespeedAI Edit] ✅ Edited image stored`);

  return { url: s3Url, key: s3Key };
}

