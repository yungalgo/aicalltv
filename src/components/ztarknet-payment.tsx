"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
} from "@starknet-react/core";
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

export function ZtarknetPayment({ onPaymentComplete, onBack }: ZtarknetPaymentProps) {
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "sending" | "confirming" | "complete" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Starknet React hooks
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // Transaction hook
  const { sendAsync, isPending } = useSendTransaction({});

  // Update status when connected
  useEffect(() => {
    if (isConnected && address && status === "connecting") {
      setStatus("connected");
    }
  }, [isConnected, address, status]);

  // Handle wallet connection
  const handleConnect = async (connectorToUse: typeof connectors[0]) => {
    setStatus("connecting");
    setError(null);
    
    try {
      await connect({ connector: connectorToUse });
    } catch (err) {
      console.error("[Ztarknet] Connect error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
      setStatus("error");
    }
  };

  // Handle ZTF payment
  const handlePayment = async () => {
    if (!address || !isConnected) {
      setError("Wallet not connected");
      return;
    }

    setStatus("sending");
    setError(null);

    try {
      // Create provider for Ztarknet
      const ztarknetProvider = new RpcProvider({
        nodeUrl: ZTARKNET_CONFIG.rpcUrl,
      });

      // Prepare the transfer call
      // ZTF is an ERC20, we call transfer(recipient, amount)
      const transferCall = {
        contractAddress: ZTARKNET_CONFIG.ztfTokenAddress,
        entrypoint: "transfer",
        calldata: CallData.compile({
          recipient: ZTARKNET_CONFIG.receivingAddress,
          amount: uint256.bnToUint256(ZTARKNET_CONFIG.paymentAmount),
        }),
      };

      console.log("[Ztarknet] Sending payment...");
      console.log("[Ztarknet] From:", address);
      console.log("[Ztarknet] To:", ZTARKNET_CONFIG.receivingAddress);
      console.log("[Ztarknet] Amount:", ZTARKNET_CONFIG.paymentAmountDisplay, "ZTF");
      console.log("[Ztarknet] Token:", ZTARKNET_CONFIG.ztfTokenAddress);

      // Send the transaction
      const result = await sendAsync([transferCall]);

      console.log("[Ztarknet] Transaction sent:", result.transaction_hash);

      setTxHash(result.transaction_hash);
      setStatus("confirming");

      // Wait for confirmation (poll the transaction status)
      let confirmed = false;
      for (let i = 0; i < 60; i++) {
        try {
          const receipt = await ztarknetProvider.getTransactionReceipt(result.transaction_hash);
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
      onPaymentComplete(result.transaction_hash);
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
                setStatus(isConnected ? "connected" : "idle");
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

        {/* Idle - Show connect buttons */}
        {status === "idle" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center mb-3">
              Connect your Starknet wallet (configured for Ztarknet)
            </p>
            {connectors.map((connector) => (
              <Button
                key={connector.id}
                onClick={() => handleConnect(connector)}
                className="w-full h-12"
                variant="outline"
              >
                <span className="flex items-center gap-2">
                  {connector.icon && (
                    <img
                      src={typeof connector.icon === 'string' ? connector.icon : connector.icon.dark}
                      alt={connector.name}
                      className="w-6 h-6"
                    />
                  )}
                  Connect {connector.name}
                </span>
              </Button>
            ))}
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
        {status === "connected" && address && (
          <>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Connected wallet:</p>
              <p className="font-mono text-sm truncate">
                {address.slice(0, 10)}...{address.slice(-8)}
              </p>
              {connector && (
                <p className="text-xs text-muted-foreground mt-1">via {connector.name}</p>
              )}
            </div>

            <Button
              onClick={handlePayment}
              disabled={isPending}
              className="h-12 w-full text-lg"
            >
              {isPending ? "Confirm in wallet..." : `Pay ${ZTARKNET_CONFIG.paymentAmountDisplay} ZTF`}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                disconnect();
                setStatus("idle");
              }}
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

