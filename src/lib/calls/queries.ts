import { createServerFn } from "@tanstack/react-start";
import { drizzle } from "drizzle-orm/postgres-js";
import { desc, eq } from "drizzle-orm";
import postgres from "postgres";
import { env } from "~/env/server";
import { calls } from "~/lib/db/schema/calls";
import * as schema from "~/lib/db/schema";
import { auth } from "~/lib/auth/auth";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Check if a presigned S3 URL has expired or will expire soon
 */
function isPresignedUrlExpired(url: string | null): boolean {
  if (!url) return false;
  
  try {
    // Check if it's a presigned URL (contains X-Amz-Expires)
    if (!url.includes("X-Amz-Expires")) {
      return false; // Public URL, never expires
    }
    
    const urlObj = new URL(url);
    const amzDate = urlObj.searchParams.get("X-Amz-Date");
    const amzExpires = urlObj.searchParams.get("X-Amz-Expires");
    
    if (!amzDate || !amzExpires) return true; // Can't determine, assume expired
    
    // Parse the X-Amz-Date (format: 20231201T123456Z)
    const year = parseInt(amzDate.substring(0, 4));
    const month = parseInt(amzDate.substring(4, 6)) - 1;
    const day = parseInt(amzDate.substring(6, 8));
    const hour = parseInt(amzDate.substring(9, 11));
    const minute = parseInt(amzDate.substring(11, 13));
    const second = parseInt(amzDate.substring(13, 15));
    
    const signedAt = new Date(Date.UTC(year, month, day, hour, minute, second));
    const expiresAt = new Date(signedAt.getTime() + parseInt(amzExpires) * 1000);
    
    // Add 1 hour buffer - refresh if expiring within the hour
    const now = new Date();
    const bufferTime = 60 * 60 * 1000; // 1 hour
    
    return now.getTime() > (expiresAt.getTime() - bufferTime);
  } catch {
    return true; // If parsing fails, assume expired
  }
}

export const getUserCalls = createServerFn({ method: "GET" }).handler(
  async () => {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: getRequest().headers,
    });

    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const userId = session.user.id;

    // Create database connection
    const driver = postgres(env.DATABASE_URL);
    const db = drizzle({ client: driver, schema, casing: "snake_case" });

    // Fetch user's calls, ordered by most recent first
    const userCalls = await db
      .select()
      .from(calls)
      .where(eq(calls.userId, userId))
      .orderBy(desc(calls.createdAt));

    // Refresh expired video URLs
    const { getFreshVideoUrl } = await import("~/lib/storage/s3");
    const refreshedCalls = await Promise.all(
      userCalls.map(async (call) => {
        // If video URL is expired and we have the S3 key, generate a fresh URL
        if (call.videoS3Key && isPresignedUrlExpired(call.videoUrl)) {
          try {
            const freshUrl = await getFreshVideoUrl(call.videoS3Key);
            // Update the database with the fresh URL
            await db
              .update(calls)
              .set({ videoUrl: freshUrl, updatedAt: new Date() })
              .where(eq(calls.id, call.id));
            return { ...call, videoUrl: freshUrl };
          } catch (error) {
            console.error(`[Calls] Failed to refresh video URL for call ${call.id}:`, error);
            return call; // Return original if refresh fails
          }
        }
        return call;
      })
    );

    // Close database connection
    await driver.end();

    return refreshedCalls;
  },
);

