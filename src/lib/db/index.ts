import { createServerOnlyFn } from "@tanstack/react-start";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "~/env/server";

import * as schema from "~/lib/db/schema";

/**
 * Create a new postgres driver for one-off connections
 * Use this when you need to manually close the connection
 */
export function createPostgresDriver() {
  return postgres(env.DATABASE_URL);
}

const driver = postgres(env.DATABASE_URL);

const getDatabase = createServerOnlyFn(() =>
  drizzle({ client: driver, schema, casing: "snake_case" }),
);

export const db = getDatabase();
