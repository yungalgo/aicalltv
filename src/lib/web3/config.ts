/**
 * Web3 configuration for RainbowKit + wagmi + Solana
 * Supports Base and Solana for USDC payments
 */

import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { metaMaskWallet } from "@rainbow-me/rainbowkit/wallets";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";

// Payment configuration
// SINGLE SOURCE OF TRUTH for pricing - all other values are derived from priceUSD
export const PAYMENT_CONFIG = {
  // TODO: Change back to 9 for production ($9.00 per call)
  // Note: Stripe minimum is $0.50, so using 0.50 for testing
  priceUSD: 0.50, // $0.50 for testing

  // Derived values - computed from priceUSD
  get priceCents(): number {
    return Math.round(this.priceUSD * 100);
  },
  get priceUsdcAtomic(): number {
    // USDC has 6 decimals on both Base and Solana
    return Math.round(this.priceUSD * 1_000_000);
  },
  get priceDisplay(): string {
    // Format for display (e.g., "0.09" or "9")
    return this.priceUSD % 1 === 0 ? String(this.priceUSD) : this.priceUSD.toFixed(2);
  },

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

  // Starknet/Ztarknet payment address - from env var
  get starknetAddress(): string {
    return import.meta.env.VITE_STARKNET_PAYMENT_ADDRESS || "";
  },

  // Starknet verifier contract (ZK proof verification)
  starknetVerifier: "0x02048def58e122c910f80619ebab076b0ef5513550d38afdfdf2d8a1710fa7c6" as const,
};

// Test mode - bypasses real payment for development
export const isPaymentTestMode = () =>
  import.meta.env.VITE_PAYMENT_TEST_MODE === "true";

// Always enable payment options - will show error if env vars not configured
export const isEvmConfigured = () => true;
export const isSolanaConfigured = () => true;

// Wallet connectors - EVM wallets only (no Phantom which is for Solana)
const connectors = connectorsForWallets(
  [
    {
      groupName: "EVM Wallets",
      wallets: [metaMaskWallet],
    },
  ],
  {
    appName: "AI Call TV",
    projectId: "optional", // Not actually used without WalletConnect wallets
  },
);

// wagmi config - Base mainnet (payments) + Base Sepolia (Fhenix FHE)
export const wagmiConfig = createConfig({
  connectors,
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});

// Re-export chains for convenience
export { base, baseSepolia };

// Fhenix uses Base Sepolia (FHE infrastructure only deployed there)
export const FHENIX_CHAIN = baseSepolia;
export const FHENIX_FAUCET_URL = "https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet";

