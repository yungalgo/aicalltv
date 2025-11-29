/**
 * Web3 configuration for RainbowKit + wagmi + Solana
 * Supports Base and Solana for USDC payments
 */

import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import {
  injectedWallet,
  metaMaskWallet,
  coinbaseWallet,
  rabbyWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";

// Payment configuration
export const PAYMENT_CONFIG = {
  priceUSD: 9,
  priceUSDC: "9000000", // 9 USDC (6 decimals for EVM)
  priceUSDCSolana: "9000000", // 9 USDC (6 decimals for Solana)

  // EVM seller address (Base)
  get evmAddress(): `0x${string}` {
    const addr = import.meta.env.VITE_EVM_PAYMENT_ADDRESS;
    return (addr ||
      "0x0000000000000000000000000000000000000000") as `0x${string}`;
  },

  // Solana seller address
  get solanaAddress(): string {
    return (
      import.meta.env.VITE_SOLANA_PAYMENT_ADDRESS ||
      "11111111111111111111111111111111"
    );
  },

  // Base USDC contract address
  baseUsdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,

  // Solana USDC token address
  solanaUsdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

// Test mode - bypasses real payment for development
export const isPaymentTestMode = () =>
  import.meta.env.VITE_PAYMENT_TEST_MODE === "true";

export const isEvmConfigured = () => !!import.meta.env.VITE_EVM_PAYMENT_ADDRESS;

export const isSolanaConfigured = () =>
  !!import.meta.env.VITE_SOLANA_PAYMENT_ADDRESS;

// Wallet connectors - browser extension wallets only (no WalletConnect needed)
const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [metaMaskWallet, coinbaseWallet, rabbyWallet, injectedWallet],
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

