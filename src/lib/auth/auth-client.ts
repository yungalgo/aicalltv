import { createAuthClient } from "better-auth/react";

// Use current origin so auth works from localhost OR ngrok
// This avoids CORS issues when browsing on localhost but env has ngrok URL
const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
});

export default authClient;
