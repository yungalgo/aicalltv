import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth/auth";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        console.log(`[Auth] GET ${request.url}`);
        try {
          const response = await auth.handler(request);
          console.log(`[Auth] GET response: ${response.status}`);
          // Read the body and create a fresh response to avoid "body disturbed" errors
          const body = await response.text();
          return new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        } catch (error) {
          console.error(`[Auth] GET error:`, error);
          return new Response(JSON.stringify({ error: "Auth failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      POST: async ({ request }: { request: Request }) => {
        console.log(`[Auth] POST ${request.url}`);
        try {
          const response = await auth.handler(request);
          console.log(`[Auth] POST response: ${response.status}`);
          // Read the body and create a fresh response to avoid "body disturbed" errors
          const body = await response.text();
          return new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        } catch (error) {
          console.error(`[Auth] POST error:`, error);
          return new Response(JSON.stringify({ error: "Auth failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
