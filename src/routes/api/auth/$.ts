import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth/auth";
import { env } from "~/env/server";

/**
 * Dynamic CORS origin check
 * Allows: localhost, VITE_BASE_URL, and any ngrok domain (dev only)
 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Always allow localhost
  if (origin === "http://localhost:3000") return true;
  
  // Allow configured base URL
  if (origin === env.VITE_BASE_URL) return true;
  
  // In development, allow any ngrok domain
  if (process.env.NODE_ENV !== "production") {
    if (origin.includes(".ngrok-free.app") || origin.includes(".ngrok.io")) {
      return true;
    }
  }
  
  return false;
}

async function addCorsHeaders(response: Response, origin: string): Promise<Response> {
  // Clone the response to avoid "body already disturbed" errors
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", origin);
  newHeaders.set("Access-Control-Allow-Credentials", "true");
  newHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  newHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Cookie, Accept");
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const response = await auth.handler(request);
        const origin = request.headers.get("origin");
        if (origin && isAllowedOrigin(origin)) {
          return addCorsHeaders(response, origin);
        }
        return response;
      },
      POST: async ({ request }) => {
        const response = await auth.handler(request);
        const origin = request.headers.get("origin");
        if (origin && isAllowedOrigin(origin)) {
          return addCorsHeaders(response, origin);
        }
        return response;
      },
      OPTIONS: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && isAllowedOrigin(origin)) {
          return new Response(null, {
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": origin,
              "Access-Control-Allow-Credentials": "true",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
              "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Cookie, Accept",
              "Access-Control-Max-Age": "86400",
            },
          });
        }
        return new Response(null, { status: 403 });
      },
    },
  },
});
