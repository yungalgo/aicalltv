import { createServerOnlyFn } from "@tanstack/react-start";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "~/env/server";

import * as schema from "~/lib/db/schema";

/**
 * Default postgres connection options optimized for Neon serverless
 */
export const neonConnectionOptions = {
  connect_timeout: 10, // 10 second connection timeout
  idle_timeout: 20, // Close idle connections after 20 seconds
  max_lifetime: 60 * 30, // Max connection lifetime of 30 minutes
  ssl: "require" as const, // SSL required for Neon
};

/**
 * Create a new postgres driver with Neon-optimized settings
 * Use this for one-off connections that need to be closed manually
 */
export function createPostgresDriver(maxConnections = 3) {
  return postgres(env.DATABASE_URL, {
    ...neonConnectionOptions,
    max: maxConnections,
  });
}

// Configure postgres for Neon serverless with proper timeout and connection settings
const driver = postgres(env.DATABASE_URL, {
  ...neonConnectionOptions,
  max: 10, // Max 10 connections in pool for the shared connection
});

const getDatabase = createServerOnlyFn(() =>
  drizzle({ client: driver, schema, casing: "snake_case" }),
);

export const db = getDatabase();
