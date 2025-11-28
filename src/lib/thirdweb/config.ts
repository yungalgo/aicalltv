/**
 * thirdweb payment configuration
 * This file contains only config values - no thirdweb SDK imports
 * to avoid SSR bundling issues with @noble/hashes
 */

export const PAYMENT_CONFIG = {
  priceUSD: 9,
  priceUSDC: "9", // As string for thirdweb
  // Seller address from env - cast happens at runtime
  get sellerAddress(): `0x${string}` {
    const addr = import.meta.env.VITE_THIRDWEB_SELLER_ADDRESS;
    return (addr || "0x0000000000000000000000000000000000000000") as `0x${string}`;
  },
  // USDC contract on Polygon
  usdcContractAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" as const,
};

export const isThirdwebConfigured = () =>
  !!import.meta.env.VITE_THIRDWEB_CLIENT_ID &&
  !!import.meta.env.VITE_THIRDWEB_SELLER_ADDRESS;

