/**
 * Standalone Worker Service
 * 
 * This runs as a separate process/service to handle heavy processing:
 * - Call processing (Twilio calls)
 * - Video generation (FFmpeg, fal.ai)
 * 
 * Deploy separately from main app:
 * - Local: bun run worker:dev
 * - Production: AWS ECS Fargate / EC2 / etc.
 */

import { setupCallProcessorWorker } from "./lib/workers/call-processor";
import { setupVideoGeneratorWorker } from "./lib/workers/video-generator";

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
    
    // Keep process alive
    // Workers will continue polling for jobs
    process.on("SIGTERM", () => {
      console.log("\n[Worker] Received SIGTERM, shutting down gracefully...");
      process.exit(0);
    });
    
    process.on("SIGINT", () => {
      console.log("\n[Worker] Received SIGINT, shutting down gracefully...");
      process.exit(0);
    });
    
  } catch (error) {
    console.error("[Worker] Failed to start worker service:", error);
    process.exit(1);
  }
}

// Start the worker service
startWorker();

