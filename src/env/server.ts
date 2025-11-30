import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    VITE_BASE_URL: z.url().default("http://localhost:3000"),
    BETTER_AUTH_SECRET: z.string().min(1),

    // OAuth2 providers, optional, update as needed
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    // Twilio configuration
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_PHONE_NUMBER: z.string().optional(),

    // OpenAI configuration
    OPENAI_API_KEY: z.string().optional(),

    // AWS S3 configuration (for storing audio/video files)
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().optional(),
    AWS_S3_BUCKET: z.string().optional(),

    // WavespeedAI configuration (for video generation)
    WAVESPEED_API_KEY: z.string().optional(),

    // Groq configuration (for prompt generation)
    GROQ_API_KEY: z.string().optional(),

    // Resend configuration (for email notifications)
    RESEND_API_KEY: z.string().optional(),

    // TESTING_MODE: Set to "true" on Railway to bypass calling hour restrictions
    // Useful for testing production without time-of-day limitations
    TESTING_MODE: z.string().optional(),

    // WebSocket server URL (for Twilio Media Streams)
    // Use ngrok URL for WebSocket server: wss://your-ws-ngrok.ngrok-free.app/twilio/stream
    WEBSOCKET_URL: z.string().optional(),

    // Stripe configuration (for credit card payments)
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    // ZCash service URL (for ZCash payments via zingolib)
    ZCASH_SERVICE_URL: z.string().optional(),
  },
  runtimeEnv: process.env,
});
