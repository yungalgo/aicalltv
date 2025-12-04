/**
 * Generate default 1:1 headshot images for all callers
 * Uses WaveSpeed nano-banana-pro text-to-image
 * 
 * Run: bun scripts/generate-caller-images.ts
 * Or use wrapper: ./scripts/run-generate-caller-images.sh
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env file manually (works with tsx without extra deps)
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const envFile = readFileSync(envPath, "utf-8");
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file may not exist, that's ok
  }
}

loadEnv();

// Get env vars directly (only what we need)
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

// Import S3 utilities after env is loaded
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Simple S3 upload function (inline to avoid env validation issues)
async function uploadToS3(options: {
  file: Buffer;
  key: string;
  contentType: string;
}): Promise<{ url: string; key: string; bucket: string }> {
  if (!AWS_S3_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS S3 credentials not configured");
  }

  const s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  const command = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: options.key,
    Body: options.file,
    ContentType: options.contentType,
    ACL: "public-read",
  });

  let isPublic = false;
  try {
    await s3Client.send(command);
    isPublic = true;
  } catch (error: unknown) {
    const err = error as { name?: string; code?: string };
    if (err.name === "AccessControlListNotSupported" || err.code === "AccessDenied") {
      const commandWithoutACL = new PutObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: options.key,
        Body: options.file,
        ContentType: options.contentType,
      });
      await s3Client.send(commandWithoutACL);
      isPublic = false;
    } else {
      throw error;
    }
  }

  let url: string;
  if (isPublic) {
    url = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${options.key}`;
  } else {
    const getCommand = new GetObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: options.key,
    });
    url = await getSignedUrl(s3Client, getCommand, { expiresIn: 86400 });
  }

  return {
    url,
    key: options.key,
    bucket: AWS_S3_BUCKET,
  };
}

// Check if file exists in S3
async function checkS3FileExists(key: string): Promise<boolean> {
  if (!AWS_S3_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    return false;
  }

  const s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  try {
    const command = new HeadObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (error: unknown) {
    const err = error as { name?: string; code?: string };
    // 404 means file doesn't exist
    if (err.name === "NotFound" || err.code === "NotFound" || err.code === "404") {
      return false;
    }
    // Other errors - assume file doesn't exist to be safe
    return false;
  }
}

const WAVESPEED_API_BASE = "https://api.wavespeed.ai/api/v3";
const MODEL_ENDPOINT = `${WAVESPEED_API_BASE}/google/nano-banana-pro/text-to-image`;

// All 24 caller characters - psychologically-crafted prank call personalities
const CALLERS = [
  // === SET 1: THE EVERYDAY HOOKS ===
  {
    slug: "sandra-neighbor",
    name: "Sandra the Neighbor",
    prompt: `Close-up professional headshot portrait, 50s white woman, face centered and filling frame, tight-lipped knowing smile, suspicious nosy expression, short dark brown hair, floral blouse visible at top, soft natural afternoon lighting, warm beige background with subtle green tint, blurred suburban window in background, vintage film grain aesthetic, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "buddy-gym",
    name: "Buddy from the Gym",
    prompt: `Close-up professional headshot portrait, buff 30s man, face centered and filling frame, enthusiastic thumbs up expression, tank top and sweatband visible, healthy glow, bright high-key lighting, vibrant blue background gradient, blurred gym equipment in background, modern crisp photography style, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "eileen-lost-pet",
    name: "Eileen with Lost Pet",
    prompt: `Close-up professional headshot portrait, quirky 40s woman, face centered and filling frame, wide desperate eyes, colorful feathers stuck to shirt, messy hair, bohemian style, warm golden hour lighting, soft pastel pink background, blurred birdcage in background, whimsical artistic style, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "frank-retired-cop",
    name: "Frank the Retired Cop",
    prompt: `Close-up professional headshot portrait, grizzled 60s man, face centered and filling frame, squinting suspicious expression, badge pin on casual shirt visible, graying stubble, low-key noir lighting with dramatic shadows, dark charcoal gray background, blurred case files in background, black and white film noir aesthetic, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "lia-book-club",
    name: "Lia from Book Club",
    prompt: `Close-up professional headshot portrait, thoughtful 30s Asian woman, face centered and filling frame, stylish glasses, knowing analytical smile, soft warm reading lamp lighting, rich burgundy wine-colored background, blurred books in background, elegant literary photography style, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "teddy-time-traveler",
    name: "Teddy the Time Traveler",
    prompt: `Close-up professional headshot portrait, intense 40s man, face centered and filling frame, subtle tinfoil accents in hair, urgent prophetic expression, dramatic cyan blue lighting with green accents, dark navy blue background with subtle tech patterns, blurred clock gadgets in background, sci-fi futuristic aesthetic, 1:1 square format, head and shoulders only`,
  },

  // === SET 2: THE SERVICE INDUSTRY CHAOS ===
  {
    slug: "rosa-delivery",
    name: "Rosa from Delivery",
    prompt: `Close-up professional headshot portrait, flustered 20s Latina woman, face centered and filling frame, uniform cap askew, confused but determined smile, bright natural daylight, cheerful yellow background, blurred delivery boxes in background, vibrant documentary photography style, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "harold-inventor",
    name: "Harold the Inventor",
    prompt: `Close-up professional headshot portrait, disheveled 70s man, face centered and filling frame, goggles pushed up on forehead, spark of genius in eyes, stained lab coat visible, warm amber workshop lighting, rusty orange background, blurred tools in background, industrial steampunk aesthetic, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "jenny-matchmaker",
    name: "Jenny the Matchmaker",
    prompt: `Close-up professional headshot portrait, enthusiastic 30s woman, face centered and filling frame, heart-shaped earrings, conspiratorial wink expression, pink and red aesthetic, bright ring light glow, hot pink background gradient, blurred vision board in background, Instagram influencer photography style, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "walter-pollster",
    name: "Walter the Pollster",
    prompt: `Close-up professional headshot portrait, aggressively average 50s man, face centered and filling frame, plain tie visible, neutral expression, flat fluorescent office lighting, sterile light gray background, blurred cubicle in background, corporate ID photo aesthetic, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "violet-fortune",
    name: "Violet the Fortune Teller",
    prompt: `Close-up professional headshot portrait, elegant 60s woman, face centered and filling frame, dramatic jewelry and headscarf, enigmatic knowing gaze, mystical purple and gold lighting, deep purple velvet background, blurred tarot cards in background, theatrical dramatic photography style, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "skippy-sales-kid",
    name: "Skippy the Sales Kid",
    prompt: `Close-up professional headshot portrait, determined 12-year-old, face centered and filling frame, scout-style uniform visible, mega-watt salesperson grin, bright cheerful afternoon lighting, sunny yellow and green background, blurred sale sign in background, playful child photography style, 1:1 square format, head and shoulders only`,
  },

  // === SET 3: THE PSYCHOLOGICAL CHAOS AGENTS ===
  {
    slug: "brad-corporate-trainer",
    name: "Brad from Corporate Training",
    prompt: `Close-up professional headshot portrait, 30s white man, face centered and filling frame, wireless earpiece visible, giant forced fake-friendly smile, harsh corporate fluorescent lighting, sterile white background with blue tint, blurred TEAMWORK poster in background, corporate headshot photography style, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "mrs-dubois-french",
    name: "Mrs. Dubois (French Teacher)",
    prompt: `Close-up professional headshot portrait, sophisticated 60s woman, face centered and filling frame, red lipstick, chalk dust on navy blazer visible, reading glasses on chain, patient but disappointed expression, soft academic lighting, elegant cream-colored background, blurred blackboard in background, classic portrait photography style, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "dj-skratch",
    name: "DJ Skratch",
    prompt: `Close-up professional headshot portrait, energetic 20s Black/Latino man, face centered and filling frame, headphones around neck, excited expression, viral energy, dynamic neon RGB lighting with color shifts, dark black background with neon accents, blurred turntables in background, urban street photography aesthetic, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "karen-census",
    name: "Karen from the Census",
    prompt: `Close-up professional headshot portrait, determined 50s white woman, face centered and filling frame, American flag pin visible, sensible glasses, pleasant but immovable expression, patriotic navy blue background, official government portrait lighting, blurred flag in background, formal ID photo style, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "nate-frat-president",
    name: "Nate (Frat President)",
    prompt: `Close-up professional headshot portrait, 20s guy, face centered and filling frame, backwards visor and Greek letters hoodie visible, enthusiastic bro expression, warm party string light lighting, vibrant red and white background, blurred party photos in background, casual social media photography style, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "trish-funeral",
    name: "Trish from Funeral Planning",
    prompt: `Close-up professional headshot portrait, blonde 40s woman, face centered and filling frame, tasteful black blazer visible, soft sympathetic creepy-cheerful smile, soft diffused professional lighting, muted sage green background, blurred flowers in background, elegant funeral home photography aesthetic, 1:1 square format, head and shoulders only`,
  },

  // === SET 4: THE TRULY UNHINGED ===
  {
    slug: "oscar-lottery-pool",
    name: "Oscar from the Office Lottery",
    prompt: `Close-up professional headshot portrait, nervous 40s Latino man, face centered and filling frame, excited and panicked expression simultaneously, dramatic high-contrast office lighting, bright gold and green background, blurred lottery posters in background, intense dramatic photography style, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "madame-zelda",
    name: "Madame Zelda",
    prompt: `Close-up professional headshot portrait, dramatic 30s woman, face centered and filling frame, headscarf adorned with coins, too many rings visible, vengeful theatrical expression, mysterious purple and orange candle lighting, deep black background with purple glow, blurred tarot cards in background, gothic mystical photography aesthetic, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "coach-melissa-mlm",
    name: "Coach Melissa (MLM Queen)",
    prompt: `Close-up professional headshot portrait, 30s woman, face centered and filling frame, perfect hair and white blazer visible, teeth-whitened mega smile, bright ring-light glow, toxic positivity energy, bright white background with gold accents, blurred vision board in background, glamour photography style, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "leo-celebrity-pa",
    name: "Leo (Celebrity PA)",
    prompt: `Close-up professional headshot portrait, stressed 20s man, face centered and filling frame, AirPods visible, starstruck excited expression, bright golden hour LA lighting, warm orange and pink sunset background, blurred Hollywood sign in background, celebrity paparazzi photography style, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "grandpa-bob",
    name: "Grandpa Bob",
    prompt: `Close-up professional headshot portrait, sweet 80s grandpa, face centered and filling frame, oxygen tubes visible, chatty confused expression, warm sepia-toned nostalgic lighting, vintage brown and tan background, blurred wood-paneled den in background, vintage family photo aesthetic, 1:1 square format, head and shoulders only`,
  },
  {
    slug: "ashley-reunion",
    name: "Ashley (High-School Reunion)",
    prompt: `Close-up professional headshot portrait, early-30s former prom queen type, face centered and filling frame, school-spirit sweater visible, megawatt smile with subtly vicious energy, bright flash photography lighting, vibrant school colors blue and gold background, blurred gymnasium banner in background, yearbook photography style, 1:1 square format, head and shoulders only`,
  },
];

async function generateImage(prompt: string): Promise<string> {
  if (!WAVESPEED_API_KEY) {
    throw new Error(
      "WavespeedAI API key not configured. Please set WAVESPEED_API_KEY environment variable",
    );
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${WAVESPEED_API_KEY}`,
  };

  const payload = {
    aspect_ratio: "1:1", // Square format for headshots
    enable_base64_output: false,
    enable_sync_mode: false,
    output_format: "png",
    prompt: prompt,
    resolution: "4k", // 4K resolution
  };

  // Submit job
  const submitResponse = await fetch(MODEL_ENDPOINT, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(payload),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(
      `WavespeedAI image API error: ${submitResponse.status} ${submitResponse.statusText} - ${errorText}`,
    );
  }

  const submitResult = await submitResponse.json();
  const requestId = submitResult.data?.id;

  if (!requestId) {
    throw new Error(
      `WavespeedAI image API error: No request ID in response - ${JSON.stringify(submitResult)}`,
    );
  }

  console.log(`   Task submitted successfully. Request ID: ${requestId}`);

  // Poll for completion (matching the example pattern)
  const resultUrl = `${WAVESPEED_API_BASE}/predictions/${requestId}/result`;
  const startTime = Date.now();
  const maxWaitTime = 300000; // 5 minutes max wait

  while (true) {
    try {
      const response = await fetch(resultUrl, {
        headers: {
          Authorization: `Bearer ${WAVESPEED_API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Error polling result: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const result = await response.json();
      const data = result.data;

      if (!data) {
        throw new Error(`Invalid response structure: ${JSON.stringify(result)}`);
      }

      const status = data.status;

      if (status === "completed") {
        const imageUrl = data.outputs?.[0];
        if (!imageUrl) {
          throw new Error("Generation completed but no outputs found");
        }
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n   ✅ Task completed in ${elapsed}s`);
        return imageUrl;
      } else if (status === "failed") {
        throw new Error(`Task failed: ${data.error || "Unknown error"}`);
      } else {
        // Log status changes
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        process.stdout.write(`\r   Processing... Status: ${status} (${elapsed}s)`);
      }

      // Check timeout
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error(`Generation timeout after ${maxWaitTime}ms`);
      }

      // Wait before next poll (100ms as per example)
      await new Promise((resolve) => setTimeout(resolve, 0.1 * 1000));
    } catch (error) {
      // If it's a network error, retry; otherwise throw
      if (error instanceof TypeError && error.message.includes("fetch")) {
        console.log(`\n   ⚠️  Network error, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      throw error;
    }
  }
}

async function main() {
  const startTime = Date.now();
  console.log("=".repeat(70));
  console.log("🎨 Generating caller headshot images...");
  console.log(`📊 Total callers to generate: ${CALLERS.length}`);
  console.log(`📁 S3 Path: callers/{slug}.png`);
  console.log("=".repeat(70));
  console.log("");

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < CALLERS.length; i++) {
    const caller = CALLERS[i];
    const s3Key = `callers/${caller.slug}.png`;
    const callerStartTime = Date.now();
    
    // Check if image already exists
    const alreadyExists = await checkS3FileExists(s3Key);
    
    console.log("");
    console.log("─".repeat(70));
    console.log(`[${i + 1}/${CALLERS.length}] 🎭 ${caller.name}`);
    console.log(`   Slug: ${caller.slug}`);
    
    if (alreadyExists) {
      console.log(`   ⏭️  Already exists in S3, skipping...`);
      console.log("─".repeat(70));
      successCount++;
      continue;
    }
    
    console.log(`   Starting generation...`);
    console.log("─".repeat(70));

    try {
      // Generate image
      const imageUrl = await generateImage(caller.prompt);

      // Download image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Upload to S3
      const uploadResult = await uploadToS3({
        file: buffer,
        key: s3Key,
        contentType: "image/png",
      });

      console.log(
        `✅ [${i + 1}/${CALLERS.length}] ${caller.name}: Uploaded to ${uploadResult.key} (${(buffer.length / 1024).toFixed(1)} KB)`,
      );
      successCount++;
    } catch (error) {
      const callerElapsed = ((Date.now() - callerStartTime) / 1000).toFixed(1);
      console.error(`❌ [${i + 1}/${CALLERS.length}] ${caller.name} FAILED after ${callerElapsed}s`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      failCount++;
    }

    const callerElapsed = ((Date.now() - callerStartTime) / 1000).toFixed(1);
    console.log(`   ⏱️  Total time for this caller: ${callerElapsed}s`);

    // Rate limit between generations (except after the last one)
    if (i < CALLERS.length - 1) {
      console.log(`   ⏳ Waiting 2 seconds before next generation...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log("");
  console.log("=".repeat(70));
  console.log("📊 GENERATION COMPLETE");
  console.log("=".repeat(70));
  console.log(`✅ Successfully generated: ${successCount}/${CALLERS.length}`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount}/${CALLERS.length}`);
  }
  console.log(`⏱️  Total time: ${totalElapsed} minutes`);
  console.log(`📁 Images saved to: callers/`);
  console.log("=".repeat(70));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

