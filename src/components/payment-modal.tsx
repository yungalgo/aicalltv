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
import { useWalletUi, useWalletUiSigner, WalletUiDropdown, type UiWalletAccount } from "@wallet-ui/react";
import { useWalletUiGill } from "@wallet-ui/react-gill";
import {
  address as toAddress,
  createTransaction,
  getBase58Decoder,
  signAndSendTransactionMessageWithSigners,
} from "gill";
import {
  getAssociatedTokenAccountAddress,
  getTransferInstruction,
  getCreateAssociatedTokenIdempotentInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "gill/programs/token";

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

// Separate component for Solana payment button that uses the signer hook
function SolanaPayButton({
  account,
  paymentStatus,
  onPaymentStart,
  onPaymentComplete,
  onPaymentError,
}: {
  account: UiWalletAccount;
  paymentStatus: "idle" | "processing" | "complete" | "error";
  onPaymentStart: () => void;
  onPaymentComplete: (signature: string) => void;
  onPaymentError: () => void;
}) {
  const client = useWalletUiGill();
  const signer = useWalletUiSigner({ account });

  const handlePayment = async () => {
    onPaymentStart();

    try {
      console.log("[Solana] Wallet:", account.address);

      // Constants
      const USDC_MINT = toAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
      const recipientAddress = toAddress(PAYMENT_CONFIG.solanaAddress);
      const tokenProgram = TOKEN_PROGRAM_ADDRESS;

      // Get associated token accounts
      const sourceAta = await getAssociatedTokenAccountAddress(USDC_MINT, signer.address, tokenProgram);
      const destinationAta = await getAssociatedTokenAccountAddress(USDC_MINT, recipientAddress, tokenProgram);

      console.log("[Solana] From ATA:", sourceAta);
      console.log("[Solana] To ATA:", destinationAta);
      console.log("[Solana] Recipient:", PAYMENT_CONFIG.solanaAddress);

      // Get latest blockhash
      const { value: latestBlockhash } = await client.rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
      console.log("[Solana] Blockhash:", latestBlockhash.blockhash);

      // Build transaction exactly like the gill token transfer example
      const transaction = createTransaction({
        feePayer: signer,
        version: "legacy",
        instructions: [
          // Create destination ATA if it doesn't exist (idempotent - won't fail if already exists)
          getCreateAssociatedTokenIdempotentInstruction({
            mint: USDC_MINT,
            payer: signer,
            tokenProgram,
            owner: recipientAddress,
            ata: destinationAta,
          }),
          // Transfer 9 USDC (9,000,000 with 6 decimals)
          getTransferInstruction({
            source: sourceAta,
            authority: signer,
            destination: destinationAta,
            amount: BigInt(9_000_000),
          }),
        ],
        latestBlockhash,
      });

      console.log("[Solana] Requesting signature...");

      // Sign and send exactly like the template
      const signatureBytes = await signAndSendTransactionMessageWithSigners(transaction);
      const signature = getBase58Decoder().decode(signatureBytes);

      console.log("[Solana] Sent! Signature:", signature);
      console.log("[Solana] https://solscan.io/tx/" + signature);

      // Wait for confirmation
      let confirmed = false;
      for (let i = 0; i < 30; i++) {
        const statusResult = await client.rpc
          .getSignatureStatuses([signature as Parameters<typeof client.rpc.getSignatureStatuses>[0][0]])
          .send();

        const status = statusResult.value[0];
        if (status) {
          if (status.err) {
            throw new Error("Transaction failed: " + JSON.stringify(status.err));
          }
          if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
            confirmed = true;
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!confirmed) {
        throw new Error("Transaction confirmation timeout");
      }

      console.log("[Solana] CONFIRMED!");
      onPaymentComplete(signature);
    } catch (err: any) {
      console.error("[Solana] Error:", err);
      onPaymentError();
    }
  };

  return (
    <Button
      onClick={handlePayment}
      disabled={paymentStatus === "processing"}
      className="h-12 w-full text-lg"
    >
      {paymentStatus === "processing" ? "Processing..." : "Pay 9 USDC"}
    </Button>
  );
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

  // Wallet UI hooks for Solana
  const { account: solanaAccount } = useWalletUi();

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
                Send {PAYMENT_CONFIG.priceUSD} USDC via Solana wallet
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

                  {/* Connect or Pay Button */}
                  {!solanaAccount ? (
                    <div className="flex justify-center">
                      <WalletUiDropdown />
                    </div>
                  ) : (
                    <SolanaPayButton
                      account={solanaAccount}
                      paymentStatus={paymentStatus}
                      onPaymentStart={() => setPaymentStatus("processing")}
                      onPaymentComplete={(signature) => {
                        setPaymentStatus("complete");
                        onPaymentComplete(signature);
                      }}
                      onPaymentError={() => setPaymentStatus("error")}
                    />
                  )}

                  {solanaAccount && (
                    <p className="text-center text-xs text-muted-foreground truncate">
                      Connected: {solanaAccount.address.slice(0, 4)}...{solanaAccount.address.slice(-4)}
                    </p>
                  )}
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
