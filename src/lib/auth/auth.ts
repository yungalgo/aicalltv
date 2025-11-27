import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { env } from "~/env/server";
import { db } from "~/lib/db";

// In development, we might access via localhost OR ngrok
// In production (Railway), VITE_BASE_URL will match the actual domain
const isDev = process.env.NODE_ENV !== "production";

export const auth = betterAuth({
  // In dev, don't set baseURL so better-auth infers from request
  // In production, use the configured URL
  baseURL: isDev ? undefined : env.VITE_BASE_URL,
  telemetry: {
    enabled: false,
  },
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  // Allow requests from localhost (dev) and configured URL
  trustedOrigins: [
    "http://localhost:3000",
    env.VITE_BASE_URL,
  ].filter(Boolean),

  // https://www.better-auth.com/docs/concepts/database#extending-core-schema
  user: {
    additionalFields: {
      freeCallCredits: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false, // Don't allow user to set this during signup
      },
    },
  },

  // https://www.better-auth.com/docs/concepts/session-management#session-caching
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // https://www.better-auth.com/docs/authentication/email-password
  emailAndPassword: {
    enabled: true,
  },
});
