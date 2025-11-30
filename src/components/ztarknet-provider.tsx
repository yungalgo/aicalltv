"use client";

import { ReactNode } from "react";
import { sepolia } from "@starknet-react/chains";
import {
  StarknetConfig,
  argent,
  braavos,
  useInjectedConnectors,
  voyager,
  publicProvider,
} from "@starknet-react/core";
import { constants } from "starknet";

// Ztarknet Configuration
export const ZTARKNET_CONFIG = {
  rpcUrl: "https://ztarknet-madara.d.karnot.xyz",
  explorerUrl: "https://explorer-zstarknet.d.karnot.xyz",
  faucetUrl: "https://faucet.ztarknet.cash/",
  // ZTF Token (Ztarknet Fee Token)
  ztfTokenAddress: "0x01ad102b4c4b3e40a51b6fb8a446275d600555bd63a95cdceed3e5cef8a6bc1d",
  // Payment amount: 0.01 ZTF (18 decimals)
  paymentAmount: BigInt("10000000000000000"), // 0.01 * 10^18
  paymentAmountDisplay: "0.01",
  // Our receiving address (set via env or use a default for testing)
  receivingAddress: import.meta.env.VITE_ZTARKNET_PAYMENT_ADDRESS || "0x0",
  chainId: constants.StarknetChainId.SN_SEPOLIA,
};

export function ZtarknetProvider({ children }: { children: ReactNode }) {
  const { connectors } = useInjectedConnectors({
    recommended: [argent(), braavos()],
    includeRecommended: "onlyIfNoConnectors",
    order: "random",
  });

  // Use sepolia chain config (Ztarknet uses same chain ID: SN_SEPOLIA)
  // The wallet should be configured to point to Ztarknet RPC manually
  // We use publicProvider here - the actual RPC is determined by the wallet's network config
  return (
    <StarknetConfig
      chains={[sepolia]}
      provider={publicProvider()}
      connectors={connectors}
      explorer={voyager}
    >
      {children}
    </StarknetConfig>
  );
}

// ERC20 ABI for ZTF token transfer
export const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
      { name: "amount", type: "core::integer::u256" },
    ],
    outputs: [{ type: "core::bool" }],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "core::starknet::contract_address::ContractAddress" },
      { name: "amount", type: "core::integer::u256" },
    ],
    outputs: [{ type: "core::bool" }],
    state_mutability: "external",
  },
] as const;

