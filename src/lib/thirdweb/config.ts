/**
 * thirdweb payment configuration
 * This file contains only config values - no thirdweb SDK imports
 * to avoid SSR bundling issues with @noble/hashes
 */

// Test mode - bypasses real payment for development
// Set VITE_PAYMENT_TEST_MODE=true in .env to enable
export const isPaymentTestMode = () =>
  import.meta.env.VITE_PAYMENT_TEST_MODE === "true";

export const PAYMENT_CONFIG = {
  priceUSD: 9,
  priceUSDC: "9", // As string for thirdweb - $9 USDC
  // Seller address from env - cast happens at runtime
  get sellerAddress(): `0x${string}` {
    const addr = import.meta.env.VITE_THIRDWEB_SELLER_ADDRESS;
    return (addr || "0x0000000000000000000000000000000000000000") as `0x${string}`;
  },
  // USDC contract addresses by chain (Base + Ethereum only)
  // Note: Solana not supported by thirdweb PayEmbed (EVM only)
  tokens: {
    // Base USDC (low fees - default destination)
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
    // Ethereum USDC
    ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const,
  },
  // Default receiving chain - Base (low fees)
  defaultChainId: 8453,
};

export const isThirdwebConfigured = () =>
  !!import.meta.env.VITE_THIRDWEB_CLIENT_ID &&
  !!import.meta.env.VITE_THIRDWEB_SELLER_ADDRESS;
