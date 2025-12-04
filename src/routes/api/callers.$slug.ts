import { createFileRoute } from "@tanstack/react-router";
import { drizzle } from "drizzle-orm/postgres-js";
import { callers } from "~/lib/db/schema/callers";
import { eq } from "drizzle-orm";
import * as schema from "~/lib/db/schema";
import { createPostgresDriver } from "~/lib/db";

export const Route = createFileRoute("/api/callers/$slug")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { slug: string } }) => {
        const driver = createPostgresDriver();
        const db = drizzle({ client: driver, schema, casing: "snake_case" });

        try {
          const caller = await db
            .select()
            .from(callers)
            .where(eq(callers.slug, params.slug))
            .limit(1);

          if (caller.length === 0) {
            return Response.json({ error: "Caller not found" }, { status: 404 });
          }

          const callerData = caller[0];
          
          // Return all caller fields
          return Response.json({
            ...callerData,
            imageUrl: callerData.webOptimizedImageUrl || callerData.defaultImageUrl,
          });
        } finally {
          await driver.end();
        }
      },
    },
  },
});

