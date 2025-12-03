/**
 * Setup S3 lifecycle policy to auto-delete temp files (audio, images)
 * 
 * Run with: bun scripts/setup-s3-lifecycle.ts
 *       or: npx tsx scripts/setup-s3-lifecycle.ts
 * 
 * NOTE: Videos are kept forever - only temp files are cleaned up.
 */

import { 
  S3Client, 
  PutBucketLifecycleConfigurationCommand,
  GetBucketLifecycleConfigurationCommand 
} from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env file manually (works with bun/tsx without extra deps)
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

const BUCKET = process.env.AWS_S3_BUCKET;
const REGION = process.env.AWS_REGION;

if (!BUCKET || !REGION) {
  console.error("❌ Missing required environment variables:");
  console.error("   AWS_S3_BUCKET:", BUCKET ? "✓" : "✗");
  console.error("   AWS_REGION:", REGION ? "✓" : "✗");
  process.exit(1);
}

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function setupLifecyclePolicy() {
  console.log(`\n🪣 Setting up lifecycle policy for bucket: ${BUCKET}\n`);

  // First, check existing lifecycle rules
  try {
    const existing = await s3Client.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: BUCKET })
    );
    console.log("📋 Existing lifecycle rules:");
    console.log(JSON.stringify(existing.Rules, null, 2));
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === "NoSuchLifecycleConfiguration") {
      console.log("📋 No existing lifecycle rules found");
    } else {
      throw error;
    }
  }

  // Define lifecycle rules - videos are kept forever, only clean up temp files
  const lifecycleRules = [
    // Clean up audio files after 7 days (only used during processing)
    {
      ID: "DeleteAudioAfter7Days",
      Status: "Enabled" as const,
      Filter: {
        Prefix: "audio/",
      },
      Expiration: {
        Days: 7,
      },
    },
    // Clean up generated images after 7 days (only used during video generation)
    {
      ID: "DeleteImagesAfter7Days",
      Status: "Enabled" as const,
      Filter: {
        Prefix: "images/",
      },
      Expiration: {
        Days: 7,
      },
    },
    // NOTE: videos/ is NOT included - videos are kept forever
  ];

  // Apply lifecycle configuration
  try {
    await s3Client.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: BUCKET,
        LifecycleConfiguration: {
          Rules: lifecycleRules,
        },
      })
    );

    console.log("\n✅ Lifecycle policy applied successfully!\n");
    console.log("📝 Rules configured:");
    lifecycleRules.forEach((rule) => {
      console.log(`   • ${rule.ID}: ${rule.Filter.Prefix}* → delete after ${rule.Expiration.Days} day(s)`);
    });

    console.log("\n📌 videos/ folder is NOT affected - videos are kept forever.");
    console.log("💡 Note: S3 lifecycle rules run once per day (around midnight UTC).");
    console.log("   Objects may persist up to 24 hours after their expiration date.\n");

  } catch (error) {
    console.error("\n❌ Failed to apply lifecycle policy:", error);
    process.exit(1);
  }
}

// Run the setup
setupLifecyclePolicy().catch(console.error);

