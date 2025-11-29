/**
 * Web3 configuration for RainbowKit + wagmi + Solana
 * Supports Base and Solana for USDC payments
 */

import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { metaMaskWallet, coinbaseWallet } from "@rainbow-me/rainbowkit/wallets";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";

// Payment configuration
export const PAYMENT_CONFIG = {
  priceUSD: 9,
  priceUSDC: "9000000", // 9 USDC (6 decimals for EVM)
  priceUSDCSolana: "9000000", // 9 USDC (6 decimals for Solana)

  // EVM seller address (Base) - from env var
  get evmAddress(): `0x${string}` {
    return (import.meta.env.VITE_EVM_PAYMENT_ADDRESS || "") as `0x${string}`;
  },

  // Solana seller address - from env var
  get solanaAddress(): string {
    return import.meta.env.VITE_SOLANA_PAYMENT_ADDRESS || "";
  },

  // Base USDC contract address (public, not sensitive)
  baseUsdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,

  // Solana USDC token address (public, not sensitive)
  solanaUsdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

// Test mode - bypasses real payment for development
export const isPaymentTestMode = () =>
  import.meta.env.VITE_PAYMENT_TEST_MODE === "true";

// Always enable payment options - will show error if env vars not configured
export const isEvmConfigured = () => true;
export const isSolanaConfigured = () => true;

// Wallet connectors - EVM wallets only (no Phantom which is for Solana)
// Coinbase Wallet is listed first as it provides FREE gas on Base via Paymaster
const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [coinbaseWallet], // Free gas on Base!
    },
    {
      groupName: "Other Wallets",
      wallets: [metaMaskWallet],
    },
  ],
  {
    appName: "AI Call TV",
    projectId: "optional", // Not actually used without WalletConnect wallets
  },
);

// wagmi config - Base only
export const wagmiConfig = createConfig({
  connectors,
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  ssr: true,
});

// Re-export chains for convenience
export { base };

