/**
 * S3 storage utilities for audio and video files
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env/server";

export interface S3UploadOptions {
  file: Buffer;
  key: string; // S3 object key (path)
  contentType: string;
  bucket?: string;
}

export interface S3UploadResult {
  url: string;
  key: string;
  bucket: string;
}

// Initialize S3 client
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_REGION) {
      throw new Error(
        "AWS credentials not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION",
      );
    }

    s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  return s3Client;
}

/**
 * Upload file to S3
 */
export async function uploadToS3(
  options: S3UploadOptions,
): Promise<S3UploadResult> {
  const client = getS3Client();
  const bucket = options.bucket || env.AWS_S3_BUCKET;

  if (!bucket) {
    throw new Error("S3 bucket not configured. Please set AWS_S3_BUCKET");
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: options.key,
    Body: options.file,
    ContentType: options.contentType,
    // Try to make public, but if ACL is disabled, use signed URLs instead
    ACL: "public-read",
  });

  let isPublic = false;
  try {
    await client.send(command);
    isPublic = true;
  } catch (error: unknown) {
    const err = error as { name?: string; code?: string };
    // If ACL fails (bucket policy doesn't allow), upload without ACL
    // We'll use signed URLs instead
    if (err.name === "AccessControlListNotSupported" || err.code === "AccessDenied") {
      // ACL not supported, will use signed URLs
      const commandWithoutACL = new PutObjectCommand({
        Bucket: bucket,
        Key: options.key,
        Body: options.file,
        ContentType: options.contentType,
      });
      await client.send(commandWithoutACL);
      isPublic = false;
    } else {
      throw error;
    }
  }

  // Return public URL (if ACL worked) or signed URL (if ACL failed)
  let url: string;
  if (isPublic) {
    url = `https://${bucket}.s3.${env.AWS_REGION}.amazonaws.com/${options.key}`;
  } else {
    // Generate signed URL valid for 24 hours (WavespeedAI needs time to process)
    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: options.key,
    });
    url = await getSignedUrl(client, getCommand, { expiresIn: 86400 }); // 24 hours
  }

  return {
    url,
    key: options.key,
    bucket,
  };
}

/**
 * Download file from S3
 */
export async function downloadFromS3(
  key: string,
  bucket?: string,
): Promise<Buffer> {
  const client = getS3Client();
  const s3Bucket = bucket || env.AWS_S3_BUCKET;

  if (!s3Bucket) {
    throw new Error("S3 bucket not configured. Please set AWS_S3_BUCKET");
  }

  const command = new GetObjectCommand({
    Bucket: s3Bucket,
    Key: key,
  });

  const response = await client.send(command);

  if (!response.Body) {
    throw new Error(`Failed to download file from S3: ${key}`);
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  const reader = response.Body.transformToWebStream().getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  return Buffer.concat(chunks);
}

/**
 * Get signed URL for S3 object (for temporary access)
 */
export async function getSignedS3Url(
  key: string,
  expiresIn: number = 3600, // 1 hour default
  bucket?: string,
): Promise<string> {
  const client = getS3Client();
  const s3Bucket = bucket || env.AWS_S3_BUCKET;

  if (!s3Bucket) {
    throw new Error("S3 bucket not configured. Please set AWS_S3_BUCKET");
  }

  const command = new GetObjectCommand({
    Bucket: s3Bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Upload audio file to S3
 */
export async function uploadAudioToS3(
  audioBuffer: Buffer,
  callId: string,
  filename?: string,
): Promise<string> {
  const key = filename || `audio/${callId}.mp3`;
  const contentType = key.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
  
  const result = await uploadToS3({
    file: audioBuffer,
    key,
    contentType,
  });

  return result.url;
}

/**
 * Upload video file to S3
 */
export async function uploadVideoToS3(
  videoBuffer: Buffer,
  callId: string,
  filename?: string,
): Promise<string> {
  const key = filename || `videos/${callId}.mp4`;
  
  const result = await uploadToS3({
    file: videoBuffer,
    key,
    contentType: "video/mp4",
  });

  return result.url;
}

/**
 * Get fresh presigned URL for video (7 days expiry - max allowed)
 * Used when stored URL has expired
 */
export async function getFreshVideoUrl(
  s3Key: string,
  bucket?: string,
): Promise<string> {
  const client = getS3Client();
  const s3Bucket = bucket || env.AWS_S3_BUCKET;

  if (!s3Bucket) {
    throw new Error("S3 bucket not configured. Please set AWS_S3_BUCKET");
  }

  const command = new GetObjectCommand({
    Bucket: s3Bucket,
    Key: s3Key,
  });

  // 7 days is the maximum for presigned URLs
  return getSignedUrl(client, command, { expiresIn: 604800 });
}

/**
 * Upload file from local path to S3
 * @param useSignedUrl - If true, always return a signed URL (for external API access)
 */
export async function uploadFileToS3(
  filePath: string,
  key: string,
  contentType: string,
  useSignedUrl: boolean = false,
): Promise<string> {
  const fs = await import("fs/promises");
  const fileBuffer = await fs.readFile(filePath);
  
  const result = await uploadToS3({
    file: fileBuffer,
    key,
    contentType,
  });

  // If useSignedUrl is true, always generate a signed URL
  // This ensures external APIs like WavespeedAI can access the file
  if (useSignedUrl) {
    const client = getS3Client();
    const getCommand = new GetObjectCommand({
      Bucket: result.bucket,
      Key: result.key,
    });
    // Generate signed URL valid for 24 hours (WavespeedAI needs time to process)
    return getSignedUrl(client, getCommand, { expiresIn: 86400 });
  }

  return result.url;
}

