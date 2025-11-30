/**
 * Starknet Configuration for Ztarknet Privacy-Preserving Payments
 * 
 * Uses starknet-react for wallet connection and transactions
 */

import { sepolia, mainnet } from "@starknet-react/chains";
import { publicProvider, argent, braavos } from "@starknet-react/core";
import type { Chain } from "@starknet-react/chains";

// Ztarknet is a fork of Starknet Sepolia
// We use Sepolia for development/hackathon
export const ZTARKNET_CHAIN: Chain = {
  ...sepolia,
  name: "Ztarknet",
  // You can customize RPC if needed
};

// Starknet configuration
export const STARKNET_CONFIG = {
  // Network to use
  chain: ZTARKNET_CHAIN,
  
  // Verifier contract address (deployed via Garaga)
  // TODO: Update after deploying verifier contract
  verifierAddress: "0x02048def58e122c910f80619ebab076b0ef5513550d38afdfdf2d8a1710fa7c6" as const,
  
  // ETH token address on Starknet (for gas payments)
  ethAddress: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" as const,
  
  // USDC address on Starknet Sepolia
  usdcAddress: "0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080" as const,
  
  // STRK token address
  strkAddress: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d" as const,
  
  // Payment recipient address
  // TODO: Set this to your receiving address
  recipientAddress: import.meta.env.VITE_STARKNET_PAYMENT_ADDRESS || "" as string,
};

// Available connectors
export const starknetConnectors = [
  argent(),
  braavos(),
];

// Provider configuration
export const starknetProviders = [
  publicProvider(),
];

// Export chains for convenience
export { sepolia, mainnet };

// Check if Starknet is configured
export const isStarknetConfigured = () => {
  return !!STARKNET_CONFIG.recipientAddress;
};

