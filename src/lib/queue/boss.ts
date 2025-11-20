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
  boss = new PgBoss({
    connectionString: env.DATABASE_URL,
  });

  await boss.start();

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

