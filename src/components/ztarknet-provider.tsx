"use client";

import { ReactNode } from "react";

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
  // Our receiving address (set via env)
  receivingAddress: import.meta.env.VITE_ZTARKNET_PAYMENT_ADDRESS || "0x0",
};

// Simple wrapper - StarknetKit handles wallet connection internally
export function ZtarknetProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
