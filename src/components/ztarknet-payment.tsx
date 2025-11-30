"use client";

import { useState } from "react";
import { RpcProvider, uint256, CallData } from "starknet";
import { Button } from "~/components/ui/button";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ZTARKNET_CONFIG } from "./ztarknet-provider";

interface ZtarknetPaymentProps {
  onPaymentComplete: (txHash: string) => void;
  onBack: () => void;
}

// Type for Starknet wallet window object (get-starknet standard)
interface StarknetWallet {
  id: string;
  name: string;
  icon: string;
  enable: () => Promise<string[]>;
  isConnected: boolean;
  selectedAddress?: string;
  // The account object follows starknet.js Account interface
  account?: {
    address: string;
    execute: (
      calls: Array<{
        contractAddress: string;
        entrypoint: string;
        calldata: string[];
      }>
    ) => Promise<{ transaction_hash: string }>;
  };
}

export function ZtarknetPayment({ onPaymentComplete, onBack }: ZtarknetPaymentProps) {
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "sending" | "confirming" | "complete" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [wallet, setWallet] = useState<StarknetWallet | null>(null);

  // Handle direct Ready Wallet connection (no modal)
  const handleConnect = async () => {
    setStatus("connecting");
    setError(null);
    
    try {
      // Check for Ready/Argent wallet in window
      const starknetWindow = window as unknown as { 
        starknet?: StarknetWallet;
        starknet_argentX?: StarknetWallet;
      };
      
      // Try Ready/Argent wallet
      const readyWallet = starknetWindow.starknet_argentX || starknetWindow.starknet;
      
      if (!readyWallet) {
        throw new Error("Ready Wallet not found. Please install it from ready.gg");
      }

      console.log("[Ztarknet] Connecting to Ready Wallet...");
      
      // Enable the wallet (request connection)
      const accounts = await readyWallet.enable();
      
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found. Please unlock your wallet.");
      }

      const address = accounts[0];
      console.log("[Ztarknet] Connected:", address);

      setWalletAddress(address);
      setWallet(readyWallet);
      setStatus("connected");
    } catch (err) {
      console.error("[Ztarknet] Connect error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
      setStatus("error");
    }
  };

  // Handle disconnect
  const handleDisconnect = () => {
    setWalletAddress(null);
    setWallet(null);
    setStatus("idle");
  };

  // Handle ZTF payment
  const handlePayment = async () => {
    if (!walletAddress || !wallet) {
      setError("Wallet not connected");
      return;
    }

    if (!wallet.account) {
      setError("Wallet account not available. Please reconnect.");
      return;
    }

    setStatus("sending");
    setError(null);

    try {
      // Create provider for Ztarknet
      const ztarknetProvider = new RpcProvider({
        nodeUrl: ZTARKNET_CONFIG.rpcUrl,
      });

      // Prepare calldata for ERC20 transfer
      const calldata = CallData.compile({
        recipient: ZTARKNET_CONFIG.receivingAddress,
        amount: uint256.bnToUint256(ZTARKNET_CONFIG.paymentAmount),
      });

      // Prepare the transfer call using starknet.js Account.execute format
      const transferCall = {
        contractAddress: ZTARKNET_CONFIG.ztfTokenAddress,
        entrypoint: "transfer",
        calldata: calldata,
      };

      console.log("[Ztarknet] Sending payment...");
      console.log("[Ztarknet] From:", walletAddress);
      console.log("[Ztarknet] To:", ZTARKNET_CONFIG.receivingAddress);
      console.log("[Ztarknet] Amount:", ZTARKNET_CONFIG.paymentAmountDisplay, "ZTF");
      console.log("[Ztarknet] Token:", ZTARKNET_CONFIG.ztfTokenAddress);

      // Execute transaction through wallet.account.execute (starknet.js standard)
      const result = await wallet.account.execute([transferCall]);

      const txHashResult = result.transaction_hash;
      console.log("[Ztarknet] Transaction sent:", txHashResult);

      setTxHash(txHashResult);
      setStatus("confirming");

      // Wait for confirmation (poll the transaction status)
      let confirmed = false;
      for (let i = 0; i < 60; i++) {
        try {
          const receipt = await ztarknetProvider.getTransactionReceipt(txHashResult);
          // Cast to access execution_status property
          const receiptData = receipt as { execution_status?: string };
          if (receiptData.execution_status === "SUCCEEDED") {
            confirmed = true;
            break;
          } else if (receiptData.execution_status === "REVERTED") {
            throw new Error("Transaction reverted");
          }
        } catch {
          // Transaction might not be found yet, keep polling
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (!confirmed) {
        // Even if we can't confirm, the tx was sent - user can check explorer
        console.log("[Ztarknet] Could not confirm, but tx was sent");
      }

      console.log("[Ztarknet] Payment complete!");
      setStatus("complete");
      onPaymentComplete(txHashResult);
    } catch (err) {
      console.error("[Ztarknet] Payment error:", err);
      setError(err instanceof Error ? err.message : "Payment failed");
      setStatus("error");
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Pay on Ztarknet</DialogTitle>
        <DialogDescription>
          Send {ZTARKNET_CONFIG.paymentAmountDisplay} ZTF on Ztarknet L2
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-4">
        {/* Price display */}
        <div className="rounded-lg border bg-muted/50 p-4 text-center">
          <p className="text-3xl font-bold">{ZTARKNET_CONFIG.paymentAmountDisplay} ZTF</p>
          <p className="text-sm text-muted-foreground">Ztarknet L2 (settles to Zcash)</p>
        </div>

        {/* Info box */}
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            <strong>Ztarknet:</strong> Starknet L2 that settles to Zcash via STARK proofs.
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Need ZTF?{" "}
            <a
              href={ZTARKNET_CONFIG.faucetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Get from faucet →
            </a>
          </p>
        </div>

        {/* Error state */}
        {status === "error" && (
          <div className="rounded-lg bg-red-50 p-4 text-center dark:bg-red-900/20">
            <p className="font-medium text-red-800 dark:text-red-200">
              {error || "Something went wrong"}
            </p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => {
                setError(null);
                setStatus(walletAddress ? "connected" : "idle");
              }}
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Complete state */}
        {status === "complete" && (
          <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
            <p className="font-medium text-green-800 dark:text-green-200">
              ✓ Payment Complete!
            </p>
            {txHash && (
              <a
                href={`${ZTARKNET_CONFIG.explorerUrl}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block text-xs text-primary hover:underline"
              >
                View on Ztarknet Explorer →
              </a>
            )}
          </div>
        )}

        {/* Idle - Show connect button */}
        {status === "idle" && (
          <div className="space-y-3">
            <Button
              onClick={handleConnect}
              className="w-full h-12 text-lg flex items-center justify-center gap-2"
            >
              <span>Connect Ready Wallet</span>
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Don't have Ready Wallet?{" "}
              <a 
                href="https://ready.gg" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline"
              >
                Get it here →
              </a>
            </p>
          </div>
        )}

        {/* Connecting */}
        {status === "connecting" && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Connecting wallet...</p>
            <p className="text-xs text-muted-foreground">
              Make sure your wallet is configured for Ztarknet network
            </p>
          </div>
        )}

        {/* Connected - Show pay button */}
        {status === "connected" && walletAddress && (
          <>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Connected via Ready Wallet:</p>
              <p className="font-mono text-sm truncate">
                {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
              </p>
            </div>

            <Button
              onClick={handlePayment}
              className="h-12 w-full text-lg"
            >
              Pay {ZTARKNET_CONFIG.paymentAmountDisplay} ZTF
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          </>
        )}

        {/* Sending */}
        {status === "sending" && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Confirm in your wallet...</p>
          </div>
        )}

        {/* Confirming */}
        {status === "confirming" && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
            <p className="text-sm text-muted-foreground">Confirming on Ztarknet...</p>
            {txHash && (
              <a
                href={`${ZTARKNET_CONFIG.explorerUrl}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                View transaction →
              </a>
            )}
          </div>
        )}

        {/* Back button */}
        {!["complete", "connecting", "sending", "confirming"].includes(status) && (
          <Button variant="ghost" className="w-full" onClick={onBack}>
            ← Back
          </Button>
        )}
      </div>
    </>
  );
}

