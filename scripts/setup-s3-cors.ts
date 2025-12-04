/**
 * Script to configure CORS on S3 bucket
 * 
 * This allows cross-origin requests from the frontend to download videos
 * Run with: bun run scripts/setup-s3-cors.ts
 */

import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

// Load environment variables from .env file
function loadEnv() {
  const fs = require("fs");
  const path = require("path");
  const envPath = path.join(process.cwd(), ".env");
  
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, "utf-8");
    envFile.split("\n").forEach((line: string) => {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    });
  }
}

loadEnv();

const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

if (!AWS_S3_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error("❌ AWS credentials not configured");
  console.error("Please set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY");
  process.exit(1);
}

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

async function setupCORS() {
  console.log(`🔧 Configuring CORS for bucket: ${AWS_S3_BUCKET}`);

  const corsConfiguration = {
    CORSRules: [
      {
        AllowedHeaders: ["*"],
        AllowedMethods: ["GET", "HEAD"],
        AllowedOrigins: [
          "http://localhost:3000",
          "http://localhost:5173",
          "https://aicall.tv",
          "https://www.aicall.tv",
          // Add your production domain here
        ],
        ExposeHeaders: [
          "Content-Length",
          "Content-Type",
          "ETag",
          "x-amz-request-id",
          "x-amz-version-id",
        ],
        MaxAgeSeconds: 3000,
      },
    ],
  };

  try {
    const command = new PutBucketCorsCommand({
      Bucket: AWS_S3_BUCKET,
      CORSConfiguration: corsConfiguration,
    });

    await s3Client.send(command);
    console.log("✅ CORS configuration applied successfully!");
    console.log("\nAllowed origins:");
    corsConfiguration.CORSRules[0].AllowedOrigins.forEach((origin) => {
      console.log(`  - ${origin}`);
    });
  } catch (error) {
    console.error("❌ Failed to configure CORS:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }
    process.exit(1);
  }
}

setupCORS();

