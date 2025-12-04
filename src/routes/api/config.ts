import { createFileRoute } from "@tanstack/react-router";

/**
 * Public config endpoint - exposes non-sensitive config to the client
 * This allows the server's TESTING_MODE to control client behavior
 */
export const Route = createFileRoute("/api/config")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          testingMode: process.env.TESTING_MODE === "true",
        });
      },
    },
  },
});

