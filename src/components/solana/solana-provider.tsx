"use client";

import { ReactNode } from "react";
import { createSolanaMainnet, createWalletUiConfig, WalletUi } from "@wallet-ui/react";
import { WalletUiGillProvider } from "@wallet-ui/react-gill";

// Create config for mainnet with custom RPC
const rpcUrl = typeof window !== "undefined" 
  ? (import.meta.env.VITE_HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com")
  : "https://api.mainnet-beta.solana.com";

const config = createWalletUiConfig({
  clusters: [
    createSolanaMainnet({ 
      label: "Mainnet",
      url: rpcUrl,
    }),
  ],
});

export function SolanaProvider({ children }: { children: ReactNode }) {
  return (
    <WalletUi config={config}>
      <WalletUiGillProvider>{children}</WalletUiGillProvider>
    </WalletUi>
  );
}

