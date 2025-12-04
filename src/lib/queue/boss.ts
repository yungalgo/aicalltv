import { PgBoss } from "pg-boss";
import { env } from "~/env/server";

let boss: PgBoss | null = null;
let bossInitializing: Promise<PgBoss> | null = null;

/**
 * Validate that the DATABASE_URL uses Neon's pooler endpoint.
 * pg-boss uses long-lived connections that WILL be killed by Neon's 5-minute idle timeout
 * unless you use the pooler endpoint (has "-pooler" in hostname).
 * 
 * Direct: ep-xxxxx.us-east-1.aws.neon.tech (subject to idle timeout)
 * Pooler: ep-xxxxx-pooler.us-east-1.aws.neon.tech (handles pooling server-side)
 */
function validateNeonPoolerUrl(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("neon.tech") && !parsed.hostname.includes("-pooler")) {
      console.warn(
        "[pg-boss] WARNING: DATABASE_URL appears to use Neon direct endpoint instead of pooler.",
        "\n  Your current hostname:", parsed.hostname,
        "\n  For pg-boss, use the pooler endpoint with '-pooler' in hostname.",
        "\n  Example: ep-xxxxx-pooler.us-east-1.aws.neon.tech",
        "\n  See: https://neon.tech/docs/connect/connection-pooling"
      );
    }
  } catch {
    // URL parsing failed, skip validation
  }
}

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
    const connectionString = env.DATABASE_URL;
    
    // Warn if not using Neon pooler endpoint
    validateNeonPoolerUrl(connectionString);
    
    console.log("[pg-boss] Initializing with connection timeout: 30s, max connections: 3");
    
    boss = new PgBoss({
      connectionString,
      // Neon serverless settings - must handle cold starts which can take 5-10s
      max: 3, // Small pool for serverless
      connectionTimeoutMillis: 30000, // 30s timeout for Neon cold starts (was 10s, too short)
      // pg-boss maintenance (keeps connection active)
      monitorIntervalSeconds: 30,
      // SSL required for Neon (node-postgres ssl option)
      ssl: { rejectUnauthorized: false },
    });

    // Handle pg-boss errors (connection drops, etc.)
    // PgBoss extends EventEmitter but types aren't exported correctly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (boss as any).on("error", (error: Error) => {
      console.error("[pg-boss] Error:", error.message);
      // If it's a connection error, log more details
      if (error.message.includes("ETIMEDOUT") || error.message.includes("Connection terminated")) {
        console.error("[pg-boss] Connection issue detected. Ensure DATABASE_URL uses Neon pooler endpoint (-pooler in hostname)");
      }
    });

    try {
      await boss.start();
      console.log("[pg-boss] Started successfully");
    } catch (error) {
      console.error("[pg-boss] Failed to start:", error);
      console.error("[pg-boss] Check that DATABASE_URL uses Neon pooler endpoint (-pooler in hostname)");
      throw error;
    }

    // Create queues if they don't exist (required before workers can start)
    // createQueue is idempotent - safe to call multiple times
    try {
      await boss.createQueue(JOB_TYPES.PROCESS_CALL);
    } catch {
      // Queue might already exist, ignore
    }
    
    try {
      await boss.createQueue(JOB_TYPES.GENERATE_VIDEO);
    } catch {
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

