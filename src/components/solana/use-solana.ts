import { useWalletUi } from "@wallet-ui/react";
import { useWalletUiGill } from "@wallet-ui/react-gill";

/**
 * Custom hook for Solana wallet and client
 */
export function useSolana() {
  const walletUi = useWalletUi();
  const client = useWalletUiGill();

  return {
    ...walletUi,
    client,
  };
}

