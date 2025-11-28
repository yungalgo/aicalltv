/**
 * Temporary file cleanup utilities
 */

import { unlink, readdir } from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";

/**
 * Clean up temporary files
 * Logs errors but doesn't throw (non-critical operation)
 */
export async function cleanupTempFiles(
  filePaths: string[],
): Promise<void> {
  const errors: Array<{ path: string; error: string }> = [];

  for (const filePath of filePaths) {
    try {
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push({ path: filePath, error: errorMessage });
    }
  }

  if (errors.length > 0) {
    console.warn(
      `[Cleanup] ${errors.length} file(s) could not be deleted`,
    );
  }
}

/**
 * Get temporary file path
 * Uses repo root /tmp directory for local development (visible for debugging)
 * Falls back to system temp directory on Railway/production
 */
export function getTempFilePath(
  callId: string,
  suffix: string,
  extension: string = "mp3",
): string {
  // Try to use repo root /tmp directory first (for local development)
  // This makes it easy to inspect temp files during development
  const repoRoot = process.cwd();
  const localTempDir = path.join(repoRoot, "tmp");
  
  // Use local temp dir if we're in development, otherwise use system temp
  // Check if we're likely in a development environment (not Railway)
  const isDevelopment = !process.env.RAILWAY_ENVIRONMENT && !process.env.VERCEL;
  const tmpDir = isDevelopment ? localTempDir : "/tmp";
  
  // Ensure directory exists (for local development)
  if (isDevelopment && !existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }
  
  return path.join(tmpDir, `${callId}-${suffix}.${extension}`);
}

/**
 * Clean up all temporary files for a specific callId
 * This is useful for error cleanup - removes all files matching the callId pattern
 */
export async function cleanupTempFilesByCallId(callId: string): Promise<void> {
  const repoRoot = process.cwd();
  const localTempDir = path.join(repoRoot, "tmp");
  const isDevelopment = !process.env.RAILWAY_ENVIRONMENT && !process.env.VERCEL;
  const tmpDir = isDevelopment ? localTempDir : "/tmp";

  if (!existsSync(tmpDir)) {
    return; // Directory doesn't exist, nothing to clean
  }

  try {
    const files = await readdir(tmpDir);
    const filesToDelete = files.filter((file) => file.startsWith(`${callId}-`));

    if (filesToDelete.length === 0) {
      return;
    }

    const deletePromises = filesToDelete.map(async (file) => {
      const filePath = path.join(tmpDir, file);
      try {
        if (existsSync(filePath)) {
          await unlink(filePath);
        }
      } catch {
        // Silently fail - cleanup is non-critical
      }
    });

    await Promise.all(deletePromises);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.warn(
      `[Cleanup] Error reading temp directory ${tmpDir}: ${errorMessage}`,
    );
  }
}

