import { createServerOnlyFn } from "@tanstack/react-start";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { reactStartCookies } from "better-auth/react-start";

import { env } from "~/env/server";
import { db } from "~/lib/db";

const getAuthConfig = createServerOnlyFn(() =>
  betterAuth({
    baseURL: env.VITE_BASE_URL,
    telemetry: {
      enabled: false,
    },
    database: drizzleAdapter(db, {
      provider: "pg",
    }),

    // Allow requests from localhost (dev) and production URLs
    // Dynamic: uses VITE_BASE_URL from env, plus localhost for dev
    trustedOrigins: [
      "http://localhost:3000",
      env.VITE_BASE_URL,
      // Allow any ngrok domain in development
      ...(process.env.NODE_ENV !== "production" ? ["*.ngrok-free.app", "*.ngrok.io"] : []),
    ].filter(Boolean),

    // Configure cookies for cross-origin support (localhost <-> ngrok)
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax", // Use 'lax' for same-site, 'none' if needed for cross-domain
        secure: process.env.NODE_ENV === "production", // Secure in production only
      },
    },

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

    // https://www.better-auth.com/docs/integrations/tanstack#usage-tips
    plugins: [reactStartCookies()],

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
  }),
);

export const auth = getAuthConfig();
