/**
 * Standalone Worker Service
 * 
 * This runs as a separate process/service to handle heavy processing:
 * - Call processing (Twilio calls)
 * - Video generation (FFmpeg, fal.ai)
 * 
 * Deploy separately from main app:
 * - Local: bun run worker:dev
 * - Production: Railway / AWS ECS Fargate / EC2 / etc.
 * 
 * Note: For Neon serverless, use the POOLED connection string to avoid
 * connection timeouts. The pooler URL has "-pooler" in the hostname.
 */

import { setupCallProcessorWorker } from "./lib/workers/call-processor";
import { setupVideoGeneratorWorker } from "./lib/workers/video-generator";
import { getBoss } from "./lib/queue/boss";

// Declare process for Bun runtime (types not available)
declare const process: {
  on(event: string, listener: () => void): void;
};

async function startWorker() {
  console.log("=".repeat(80));
  console.log("🚀 Starting Worker Service");
  console.log("=".repeat(80));
  
  try {
    // Initialize both workers
    await setupCallProcessorWorker();
    await setupVideoGeneratorWorker();
    
    console.log("✅ Worker service initialized successfully");
    console.log("📊 Listening for jobs from pg-boss queue...");
    console.log("=".repeat(80));
    
    // Get boss instance for graceful shutdown
    const boss = await getBoss();
    
    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      console.log(`\n[Worker] Received ${signal}, shutting down gracefully...`);
      try {
        await boss.stop();
      } catch {
        // Ignore stop errors
      }
    };
    
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    
  } catch (error) {
    console.error("[Worker] Failed to start worker service:", error);
  }
}

// Start the worker service
startWorker();

