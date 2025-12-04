import { createFileRoute } from "@tanstack/react-router";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { callers } from "~/lib/db/schema/callers";
import { eq, asc } from "drizzle-orm";
import * as schema from "~/lib/db/schema";
import { env } from "~/env/server";
import { createPostgresDriver } from "~/lib/db";

export const Route = createFileRoute("/api/callers")({
  server: {
    handlers: {
      GET: async () => {
        const driver = createPostgresDriver();
        const db = drizzle({ client: driver, schema, casing: "snake_case" });

        try {
          const activeCallers = await db
            .select({
              id: callers.id,
              slug: callers.slug,
              name: callers.name,
              tagline: callers.tagline,
              defaultImageUrl: callers.defaultImageUrl,
              gender: callers.gender,
            })
            .from(callers)
            .where(eq(callers.isActive, true))
            .orderBy(asc(callers.displayOrder));

          return Response.json(activeCallers);
        } finally {
          await driver.end();
        }
      },
    },
  },
});

