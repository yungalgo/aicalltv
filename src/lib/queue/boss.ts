import { PgBoss } from "pg-boss";
import { env } from "~/env/server";

let boss: PgBoss | null = null;
let bossInitializing: Promise<PgBoss> | null = null;

export async function getBoss(): Promise<PgBoss> {
  // Return existing instance if available
  if (boss) {
    return boss;
  }

  // If already initializing, wait for that to complete
  if (bossInitializing) {
    return bossInitializing;
  }

  // Start initialization
  bossInitializing = (async () => {
    // Use pooled connection URL if available (recommended for Neon serverless)
    // Neon pooler URLs have "-pooler" in the hostname
    const connectionString = env.DATABASE_URL;
    
    boss = new PgBoss({
      connectionString,
      // Connection pool settings (small for serverless)
      max: 3,
      // Monitoring interval (helps keep connection alive)
      monitorIntervalSeconds: 30,
    });

    // Handle pg-boss errors (connection drops, etc.)
    // PgBoss extends EventEmitter but types aren't exported correctly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (boss as any).on("error", (error: Error) => {
      console.error("[pg-boss] Error:", error.message);
    });

    await boss.start();
    console.log("[pg-boss] Started successfully");

    // Create queues if they don't exist (required before workers can start)
    // createQueue is idempotent - safe to call multiple times
    try {
      await boss.createQueue(JOB_TYPES.PROCESS_CALL);
    } catch (error) {
      // Queue might already exist, ignore
    }
    
    try {
      await boss.createQueue(JOB_TYPES.GENERATE_VIDEO);
    } catch (error) {
      // Queue might already exist, ignore
    }

  return boss;
  })();

  return bossInitializing;
}

// Job types
export const JOB_TYPES = {
  PROCESS_CALL: "process-call",
  GENERATE_VIDEO: "generate-video",
} as const;

