import { createServerOnlyFn } from "@tanstack/react-start";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "~/env/server";

import * as schema from "~/lib/db/schema";

/**
 * Postgres.js connection options for Neon serverless.
 * 
 * IMPORTANT: For Neon, the DATABASE_URL should use the POOLER endpoint
 * (has "-pooler" in hostname) for long-lived connections like workers.
 * Direct connections may timeout after 5 minutes of inactivity.
 * 
 * Direct: ep-xxxxx.us-east-1.aws.neon.tech (subject to idle timeout)
 * Pooler: ep-xxxxx-pooler.us-east-1.aws.neon.tech (handles pooling server-side)
 */
const postgresOptions = {
  // Connection timeout for Neon cold starts (can take 5-10s)
  connect_timeout: 30,
  // Keep connections alive
  idle_timeout: 0, // Never close idle connections (postgres.js default)
  // Limit concurrent connections for serverless
  max: 5,
};

/**
 * Create a new postgres driver for one-off connections
 * Use this when you need to manually close the connection
 */
export function createPostgresDriver() {
  return postgres(env.DATABASE_URL, postgresOptions);
}

const driver = postgres(env.DATABASE_URL, postgresOptions);

const getDatabase = createServerOnlyFn(() =>
  drizzle({ client: driver, schema, casing: "snake_case" }),
);

export const db = getDatabase();
