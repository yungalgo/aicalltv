// CORS is now handled directly in the auth route handler
// This plugin is kept as a fallback but may not be needed
// If you see CORS errors, the route handler should handle them

// For now, commenting out to avoid import issues
// Uncomment if needed after verifying route handler CORS works

/*
import { defineNitroPlugin } from "nitro/vite";
import { fromNodeMiddleware } from "h3";
import cors from "cors";

export default defineNitroPlugin((nitroApp) => {
  const allowedOrigins = [
    "http://localhost:3000",
    "https://928ed6f9e900.ngrok-free.app",
    process.env.VITE_BASE_URL,
  ].filter(Boolean) as string[];

  nitroApp.h3App.use(
    fromNodeMiddleware(
      cors({
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin) || origin.includes(".ngrok-free.app")) {
            callback(null, true);
          } else {
            callback(new Error("Not allowed by CORS"));
          }
        },
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Cookie", "Accept"],
        credentials: true,
        maxAge: 86400,
      }),
    ),
  );
});
*/

