"use client";

import { createThirdwebClient } from "thirdweb";

// Re-export config for convenience (doesn't import thirdweb SDK)
export { PAYMENT_CONFIG, isThirdwebConfigured } from "./config";

// Create thirdweb client - only used on client side
export const thirdwebClient = createThirdwebClient({
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID || "",
});
