// Initialize all workers on server startup
// NOTE: In production, workers should run as a separate service
// Set RUN_WORKERS=false to disable workers in main app
import { setupCallProcessorWorker } from "./call-processor";
import { setupVideoGeneratorWorker } from "./video-generator";

let workersInitialized = false;

export async function initializeWorkers() {
  if (workersInitialized) {
    return;
  }

  // Skip if running as standalone worker service
  if (process.env.WORKER_MODE === "true") {
    console.log("[Workers] Skipping initialization (running as worker service)");
    return;
  }

  // Skip if explicitly disabled (for production deployments)
  if (process.env.RUN_WORKERS === "false") {
    console.log("[Workers] Skipping initialization (RUN_WORKERS=false)");
    return;
  }

  // Only initialize on server-side
  if (typeof window === "undefined") {
    console.log("[Workers] Initializing workers in main app (development mode)");
    
    try {
      await setupCallProcessorWorker();
    } catch (error) {
      console.error("[Workers] Failed to setup call processor worker:", error);
    }
    
    try {
      await setupVideoGeneratorWorker();
    } catch (error) {
      console.error("[Workers] Failed to setup video generator worker:", error);
    }
    
    workersInitialized = true;
    console.log("[Workers] Worker initialization completed");
  }
}

