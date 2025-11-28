"use client";

import { createThirdwebClient, type ThirdwebClient } from "thirdweb";

// Re-export config for convenience (doesn't import thirdweb SDK)
export { PAYMENT_CONFIG, isThirdwebConfigured, isPaymentTestMode } from "./config";

// Create thirdweb client - only used on client side
// Returns null if clientId is not configured (test mode will be used instead)
const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID;

export const thirdwebClient: ThirdwebClient | null = clientId
  ? createThirdwebClient({ clientId })
  : null;
