import { createThirdwebClient } from "thirdweb";

// Create thirdweb client
// In development, we use testnet mode
export const thirdwebClient = createThirdwebClient({
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID || "",
});

// Payment configuration
export const PAYMENT_CONFIG = {
  // Price per video call
  priceUSD: 9,
  priceUSDC: "9", // As string for thirdweb
  
  // Seller wallet address (receives payments)
  sellerAddress: import.meta.env.VITE_THIRDWEB_SELLER_ADDRESS || "",
  
  // Supported chains for payment
  // Using Polygon for USDC payments (low fees)
  // Can also support Solana, Ethereum, etc.
} as const;

