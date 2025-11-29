"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useChainId,
} from "wagmi";
import { parseUnits } from "viem";
import type { PublicKey, Transaction } from "@solana/web3.js";
import {
  PAYMENT_CONFIG,
  isEvmConfigured,
  isSolanaConfigured,
  isPaymentTestMode,
  base,
} from "~/lib/web3/config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

// Phantom wallet provider type
interface PhantomProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect?: () => Promise<void>;
  signAndSendTransaction: (
    transaction: Transaction,
    options?: { skipPreflight?: boolean; preflightCommitment?: string }
  ) => Promise<{ signature: string }>;
}

// ERC20 transfer ABI (minimal)
const erc20Abi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

type PaymentStep = "select-method" | "select-crypto" | "pay-base" | "pay-solana";

export interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentComplete: (transactionHash: string) => void;
  callDetails: {
    recipientName: string;
  };
}

export function PaymentModal({
  open,
  onOpenChange,
  onPaymentComplete,
  callDetails,
}: PaymentModalProps) {
  const [step, setStep] = useState<PaymentStep>("select-method");
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "processing" | "complete" | "error"
  >("idle");

  // EVM hooks
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContract, data: txHash, isPending, error } = useWriteContract();

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  // Handle successful transaction
  if (isConfirmed && paymentStatus !== "complete" && txHash) {
    setPaymentStatus("complete");
    onPaymentComplete(txHash);
  }

  const isTestMode = isPaymentTestMode();

  // Reset state when modal closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("select-method");
      setPaymentStatus("idle");
    }
    onOpenChange(isOpen);
  };

  // Handle Base payment - switches chain if needed and sends tx
  const handleBasePayment = async () => {
    if (!isConnected || !address) return;

    setPaymentStatus("processing");

    try {
      // Switch to Base first if not on it
      if (chainId !== base.id) {
        console.log("[Base] Switching to Base chain...");
        await switchChainAsync({ chainId: base.id });
        // Give wagmi a moment to sync state
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log("[Base] Sending USDC transfer...");
      // Send the USDC transfer with explicit chain
      writeContract({
        address: PAYMENT_CONFIG.baseUsdc,
        abi: erc20Abi,
        functionName: "transfer",
        args: [
          PAYMENT_CONFIG.evmAddress,
          parseUnits("9", 6), // 9 USDC (6 decimals)
        ],
        chain: base, // Pass chain object instead of chainId
      });
    } catch (err) {
      console.error("[Base] Payment error:", err);
      setPaymentStatus("error");
    }
  };

  // Handle Solana payment (Phantom)
  const handleSolanaPayment = async () => {
    try {
      // Check if Phantom is installed
      const phantom = (window as unknown as { phantom?: { solana?: PhantomProvider } })?.phantom?.solana;
      if (!phantom?.isPhantom) {
        // Open Phantom website if not installed
        window.open("https://phantom.app/", "_blank");
        return;
      }

      setPaymentStatus("processing");

      // Connect to Phantom with retry
      let publicKey;
      try {
        const resp = await phantom.connect();
        publicKey = resp.publicKey;
      } catch (connectErr) {
        // Try disconnect and reconnect if there's a port error
        console.log("[Solana] Connection failed, trying to reconnect...");
        try {
          await phantom.disconnect?.();
        } catch {}
        const resp = await phantom.connect();
        publicKey = resp.publicKey;
      }
      console.log("[Solana] Connected:", publicKey.toString());

      // Import Solana libraries dynamically
      const { 
        Connection, 
        PublicKey, 
        Transaction,
        ComputeBudgetProgram,
      } = await import("@solana/web3.js");
      const {
        getAssociatedTokenAddress,
        createTransferInstruction,
        createAssociatedTokenAccountInstruction,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      } = await import("@solana/spl-token");

      // Set up connection - use Helius RPC (from env var)
      const heliusRpc = import.meta.env.VITE_HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
      console.log("[Solana] Using RPC:", heliusRpc.substring(0, 50) + "...");
      const connection = new Connection(heliusRpc, "confirmed");

      // USDC token mint on Solana
      const usdcMint = new PublicKey(PAYMENT_CONFIG.solanaUsdc);
      const recipientPublicKey = new PublicKey(PAYMENT_CONFIG.solanaAddress);

      // Get token accounts
      const senderTokenAccount = await getAssociatedTokenAddress(
        usdcMint,
        publicKey
      );
      const recipientTokenAccount = await getAssociatedTokenAddress(
        usdcMint,
        recipientPublicKey
      );

      console.log("[Solana] Sender token account:", senderTokenAccount.toString());
      console.log("[Solana] Recipient token account:", recipientTokenAccount.toString());

      // Check if recipient token account exists
      const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
      
      // Create transaction with priority fees for reliable landing
      const transaction = new Transaction();
      
      // Add priority fee (helps transaction land faster)
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 50000, // Priority fee
        })
      );

      // If recipient doesn't have a USDC token account, create it
      if (!recipientAccountInfo) {
        console.log("[Solana] Creating recipient token account...");
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey, // payer
            recipientTokenAccount, // ata
            recipientPublicKey, // owner
            usdcMint, // mint
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      // Add the transfer instruction
      transaction.add(
        createTransferInstruction(
          senderTokenAccount,
          recipientTokenAccount,
          publicKey,
          9_000_000, // 9 USDC (6 decimals)
          [],
          TOKEN_PROGRAM_ID
        )
      );

      // Get fresh blockhash with "confirmed" commitment (not "finalized" - more recent)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      console.log("[Solana] Blockhash:", blockhash);
      console.log("[Solana] Last valid block height:", lastValidBlockHeight);

      // Sign and send via Phantom with options
      console.log("[Solana] Requesting signature from Phantom...");
      const { signature } = await phantom.signAndSendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: "confirmed", // Match blockhash commitment
      });

      console.log("[Solana] Transaction sent:", signature);
      console.log("[Solana] View on Solscan: https://solscan.io/tx/" + signature);

      // Retry confirmation while blockhash is valid
      let confirmed = false;
      const startTime = Date.now();
      const maxWaitTime = 60000; // 60 seconds max

      while (!confirmed && Date.now() - startTime < maxWaitTime) {
        try {
          // Check current block height
          const currentBlockHeight = await connection.getBlockHeight("confirmed");
          
          if (currentBlockHeight > lastValidBlockHeight) {
            console.warn("[Solana] Block height exceeded, transaction may have expired");
            break;
          }

          // Check transaction status
          const status = await connection.getSignatureStatus(signature);
          
          if (status.value?.err) {
            throw new Error("Transaction failed: " + JSON.stringify(status.value.err));
          }
          
          if (status.value?.confirmationStatus === "confirmed" || status.value?.confirmationStatus === "finalized") {
            console.log("[Solana] Transaction confirmed!", status.value.confirmationStatus);
            confirmed = true;
            break;
          }

          // Wait before retry
          console.log("[Solana] Waiting for confirmation...", status.value?.confirmationStatus || "pending");
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (checkErr) {
          console.warn("[Solana] Error checking status, retrying...", checkErr);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!confirmed) {
        // Final check
        const finalStatus = await connection.getSignatureStatus(signature);
        if (finalStatus.value?.confirmationStatus) {
          console.log("[Solana] Final status:", finalStatus.value.confirmationStatus);
          confirmed = finalStatus.value.confirmationStatus === "confirmed" || finalStatus.value.confirmationStatus === "finalized";
        }
      }

      if (!confirmed) {
        throw new Error("Transaction not confirmed. Check Solscan: https://solscan.io/tx/" + signature);
      }

      setPaymentStatus("complete");
      onPaymentComplete(signature);
    } catch (err) {
      console.error("[Solana] Payment error:", err);
      setPaymentStatus("error");
    }
  };

  // Test mode bypass
  if (isTestMode) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>🧪 Test Mode</DialogTitle>
            <DialogDescription>
              Test mode enabled. Click to simulate payment.
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => {
              onPaymentComplete(`test_tx_${Date.now()}`);
            }}
            className="w-full"
          >
            Simulate Payment
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Step 1: Select Payment Method */}
        {step === "select-method" && (
          <>
            <DialogHeader>
              <DialogTitle>Pay ${PAYMENT_CONFIG.priceUSD}</DialogTitle>
              <DialogDescription>
                AI Call to {callDetails.recipientName}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              {/* Credit Card - Disabled */}
              <Button
                variant="outline"
                className="h-14 w-full justify-start gap-3 opacity-50"
                disabled
              >
                <span className="text-xl">💳</span>
                <div className="text-left">
                  <div className="font-medium">Pay with Credit Card</div>
                  <div className="text-xs text-muted-foreground">
                    Coming soon
                  </div>
                </div>
              </Button>

              {/* Crypto */}
              <Button
                variant="outline"
                className="h-14 w-full justify-start gap-3"
                onClick={() => setStep("select-crypto")}
              >
                <span className="text-xl">🪙</span>
                <div className="text-left">
                  <div className="font-medium">Pay with Crypto</div>
                  <div className="text-xs text-muted-foreground">
                    USDC on Base or Solana
                  </div>
                </div>
              </Button>
            </div>
          </>
        )}

        {/* Step 2: Select Crypto Chain */}
        {step === "select-crypto" && (
          <>
            <DialogHeader>
              <DialogTitle>Select Network</DialogTitle>
              <DialogDescription>
                Pay {PAYMENT_CONFIG.priceUSD} USDC
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              {/* Base */}
              <Button
                variant="outline"
                className="h-14 w-full justify-start gap-3"
                onClick={() => setStep("pay-base")}
                disabled={!isEvmConfigured()}
              >
                <span className="text-xl">🔵</span>
                <div className="text-left">
                  <div className="font-medium">Pay on Base</div>
                  <div className="text-xs text-muted-foreground">
                    9 USDC • Low fees
                  </div>
                </div>
              </Button>

              {/* Solana */}
              <Button
                variant="outline"
                className="h-14 w-full justify-start gap-3"
                onClick={() => setStep("pay-solana")}
                disabled={!isSolanaConfigured()}
              >
                <span className="text-xl">◎</span>
                <div className="text-left">
                  <div className="font-medium">Pay on Solana</div>
                  <div className="text-xs text-muted-foreground">
                    9 USDC • Phantom
                  </div>
                </div>
              </Button>

              {/* Starknet - Coming Soon */}
              <Button
                variant="outline"
                className="h-14 w-full justify-start gap-3 opacity-50"
                disabled
              >
                <span className="text-xl">⬡</span>
                <div className="text-left">
                  <div className="font-medium">Pay on Starknet</div>
                  <div className="text-xs text-muted-foreground">
                    Coming soon
                  </div>
                </div>
              </Button>

              {/* ZCash - Coming Soon */}
              <Button
                variant="outline"
                className="h-14 w-full justify-start gap-3 opacity-50"
                disabled
              >
                <span className="text-xl">🔒</span>
                <div className="text-left">
                  <div className="font-medium">Pay on ZCash</div>
                  <div className="text-xs text-muted-foreground">
                    Coming soon
                  </div>
                </div>
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setStep("select-method")}
              >
                ← Back
              </Button>
            </div>
          </>
        )}

        {/* Step 3a: Pay on Base */}
        {step === "pay-base" && (
          <>
            <DialogHeader>
              <DialogTitle>Pay on Base</DialogTitle>
              <DialogDescription>
                Send {PAYMENT_CONFIG.priceUSD} USDC
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              {paymentStatus === "complete" ? (
                <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    ✓ Payment Complete!
                  </p>
                </div>
              ) : paymentStatus === "error" || error ? (
                <div className="rounded-lg bg-red-50 p-4 text-center dark:bg-red-900/20">
                  <p className="font-medium text-red-800 dark:text-red-200">
                    Payment Failed
                  </p>
                  <p className="mt-1 text-sm text-red-600 dark:text-red-300">
                    {error?.message || "Please try again"}
                  </p>
                </div>
              ) : (
                <>
                  {/* Price */}
                  <div className="rounded-lg border bg-muted/50 p-4 text-center">
                    <p className="text-3xl font-bold">9 USDC</p>
                    <p className="text-sm text-muted-foreground">on Base</p>
                  </div>

                  {/* Connect or Pay Button */}
                  <ConnectButton.Custom>
                    {({ account, chain, openConnectModal, mounted }) => {
                      const connected = mounted && account && chain;

                      return (
                        <Button
                          onClick={connected ? handleBasePayment : openConnectModal}
                          disabled={connected && (isPending || isConfirming)}
                          className="h-12 w-full text-lg"
                        >
                          {!connected
                            ? "Connect Wallet"
                            : chain?.id !== base.id
                              ? "Switch to Base & Pay"
                              : isPending
                                ? "Confirm in wallet..."
                                : isConfirming
                                  ? "Confirming..."
                                  : "Pay 9 USDC"}
                        </Button>
                      );
                    }}
                  </ConnectButton.Custom>
                </>
              )}

              {paymentStatus !== "complete" && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setStep("select-crypto");
                    setPaymentStatus("idle");
                  }}
                >
                  ← Back
                </Button>
              )}
            </div>
          </>
        )}

        {/* Step 3b: Pay on Solana */}
        {step === "pay-solana" && (
          <>
            <DialogHeader>
              <DialogTitle>Pay on Solana</DialogTitle>
              <DialogDescription>
                Send {PAYMENT_CONFIG.priceUSD} USDC via Phantom
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              {paymentStatus === "complete" ? (
                <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    ✓ Payment Complete!
                  </p>
                </div>
              ) : paymentStatus === "error" ? (
                <div className="rounded-lg bg-red-50 p-4 text-center dark:bg-red-900/20">
                  <p className="font-medium text-red-800 dark:text-red-200">
                    Payment Failed
                  </p>
                  <p className="mt-1 text-sm text-red-600 dark:text-red-300">
                    Please try again
                  </p>
                </div>
              ) : (
                <>
                  {/* Price */}
                  <div className="rounded-lg border bg-muted/50 p-4 text-center">
                    <p className="text-3xl font-bold">9 USDC</p>
                    <p className="text-sm text-muted-foreground">on Solana</p>
                  </div>

                  {/* Pay Button */}
                  <Button
                    onClick={handleSolanaPayment}
                    disabled={paymentStatus === "processing"}
                    className="h-12 w-full text-lg"
                  >
                    {paymentStatus === "processing" ? (
                      "Processing..."
                    ) : (
                      <>
                        <span className="mr-2">👻</span>
                        Connect Phantom & Pay
                      </>
                    )}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    Requires Phantom wallet extension
                  </p>
                </>
              )}

              {paymentStatus !== "complete" && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setStep("select-crypto");
                    setPaymentStatus("idle");
                  }}
                >
                  ← Back
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
