"use client";

import { ReactNode } from "react";
import { StarknetConfig, useInjectedConnectors } from "@starknet-react/core";
import { sepolia } from "@starknet-react/chains";
import { publicProvider } from "@starknet-react/core";
import { argent, braavos } from "@starknet-react/core";

interface StarknetProviderProps {
  children: ReactNode;
}

export function StarknetProvider({ children }: StarknetProviderProps) {
  // Use injected connectors (Argent, Braavos, etc.)
  const { connectors } = useInjectedConnectors({
    // Recommended wallets
    recommended: [argent(), braavos()],
    // Include all injected wallets
    includeRecommended: "always",
  });

  return (
    <StarknetConfig
      chains={[sepolia]}
      provider={publicProvider()}
      connectors={connectors}
      autoConnect={true}
    >
      {children}
    </StarknetConfig>
  );
}

