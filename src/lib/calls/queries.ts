import { createServerFn } from "@tanstack/react-start";
import { drizzle } from "drizzle-orm/postgres-js";
import { desc, eq } from "drizzle-orm";
import postgres from "postgres";
import { env } from "~/env/server";
import { calls } from "~/lib/db/schema/calls";
import * as schema from "~/lib/db/schema";
import { auth } from "~/lib/auth/auth";
import { getRequest } from "@tanstack/react-start/server";

export const getUserCalls = createServerFn({ method: "GET" }).handler(
  async () => {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: getRequest().headers,
    });

    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const userId = session.user.id;

    // Create database connection
    const driver = postgres(env.DATABASE_URL);
    const db = drizzle({ client: driver, schema, casing: "snake_case" });

    // Fetch user's calls, ordered by most recent first
    const userCalls = await db
      .select()
      .from(calls)
      .where(eq(calls.userId, userId))
      .orderBy(desc(calls.createdAt));

    // Close database connection
    await driver.end();

    return userCalls;
  },
);

