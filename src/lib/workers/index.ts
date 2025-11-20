// Initialize all workers on server startup
import { setupCallProcessorWorker } from "./call-processor";
import { setupVideoGeneratorWorker } from "./video-generator";

let workersInitialized = false;

export async function initializeWorkers() {
  if (workersInitialized) {
    return;
  }

  // Only initialize on server-side
  if (typeof window === "undefined") {
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

