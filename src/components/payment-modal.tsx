"use client";

import { useState, useEffect, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useChainId,
} from "wagmi";
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
import { useWalletUi, useWalletUiSigner, type UiWalletAccount } from "@wallet-ui/react";
import { useWalletUiGill } from "@wallet-ui/react-gill";
import {
  address as toAddress,
  getBase58Decoder,
  signAndSendTransactionMessageWithSigners,
} from "gill";
import {
  buildTransferTokensTransaction,
  TOKEN_PROGRAM_ADDRESS,
} from "gill/programs/token";
import { createCredit } from "~/lib/credits/functions";

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

type PaymentStep = "select-method" | "select-crypto" | "pay-base" | "pay-solana" | "pay-stripe";

// Helper to get user-friendly error message
function getPaymentErrorMessage(error: Error | null | undefined): { title: string; message: string; isCancelled: boolean } {
  const errorMsg = error?.message?.toLowerCase() || "";
  
  // User rejected/cancelled the transaction
  if (
    errorMsg.includes("user rejected") ||
    errorMsg.includes("user denied") ||
    errorMsg.includes("rejected the request") ||
    errorMsg.includes("cancelled") ||
    errorMsg.includes("canceled")
  ) {
    return {
      title: "Transaction Cancelled",
      message: "You cancelled the transaction. Click below to try again.",
      isCancelled: true,
    };
  }
  
  // Insufficient funds
  if (errorMsg.includes("insufficient") || errorMsg.includes("not enough")) {
    return {
      title: "Insufficient Balance",
      message: "You don't have enough USDC or ETH for gas fees.",
      isCancelled: false,
    };
  }
  
  // Generic error
  return {
    title: "Payment Failed",
    message: "Something went wrong. Please try again.",
    isCancelled: false,
  };
}

export interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentComplete: (transactionHash: string) => void;
  callDetails: {
    recipientName: string;
    phoneNumber?: string;
    targetGender?: string;
    targetGenderCustom?: string;
    targetAgeRange?: string;
    interestingPiece?: string;
    videoStyle?: string;
    anythingElse?: string;
  };
}

// Phantom connect button component
function PhantomConnectButton({
  phantomWallets,
  onConnect,
}: {
  phantomWallets: ReturnType<typeof useWalletUi>['wallets'];
  onConnect: (account: UiWalletAccount) => void;
}) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (phantomWallets.length === 0) {
      window.open("https://phantom.app/", "_blank");
      return;
    }

    const phantom = phantomWallets[0];
    setIsConnecting(true);
    
    try {
      // Connect to Phantom and get accounts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connectFeature = (phantom.features as any)['standard:connect'];
      if (connectFeature) {
        const result = await connectFeature.connect();
        if (result.accounts.length > 0) {
          onConnect(result.accounts[0] as UiWalletAccount);
        }
      }
    } catch (err) {
      console.error("[Phantom] Connect error:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Button
      onClick={handleConnect}
      disabled={isConnecting}
      className="h-12 w-full text-lg"
    >
      {isConnecting 
        ? "Connecting..." 
        : phantomWallets.length > 0 
          ? "Connect Phantom" 
          : "Install Phantom Wallet"}
    </Button>
  );
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

      console.log("[Solana] Recipient:", PAYMENT_CONFIG.solanaAddress);

      // Get latest blockhash
      const { value: latestBlockhash } = await client.rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
      console.log("[Solana] Blockhash:", latestBlockhash.blockhash);

      // Build transaction using the gill builder (exactly like the example)
      const transaction = await buildTransferTokensTransaction({
        feePayer: signer,
        version: "legacy",
        latestBlockhash,
        amount: PAYMENT_CONFIG.priceUsdcAtomic,
        authority: signer,
        destination: recipientAddress,
        mint: USDC_MINT,
        tokenProgram,
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

      // Create credit on server
      try {
        console.log("[Solana] Creating credit for tx:", signature);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (createCredit as any)({
          data: {
            paymentMethod: "sol",
            paymentRef: signature,
            network: "solana",
            amountCents: PAYMENT_CONFIG.priceCents,
          },
        });
        console.log("[Solana] Credit created successfully");
      } catch (creditErr) {
        console.error("[Solana] Failed to create credit:", creditErr);
        // Still complete - tx is on chain, support can help if needed
      }

      onPaymentComplete(signature);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      {paymentStatus === "processing" ? "Processing..." : `Pay ${PAYMENT_CONFIG.priceDisplay} USDC`}
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
  const { writeContract, data: txHash, isPending, error, reset: resetWriteContract } = useWriteContract();

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  // Track if we've already processed this tx (prevent duplicate credit creation)
  const processedTxRef = useRef<string | null>(null);

  // Handle successful Base transaction - create credit then complete
  useEffect(() => {
    if (isConfirmed && txHash && processedTxRef.current !== txHash) {
      processedTxRef.current = txHash;
      
      // Create credit on server
      (async () => {
        try {
          console.log("[Base] Creating credit for tx:", txHash);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (createCredit as any)({
            data: {
              paymentMethod: "web3_wallet",
              paymentRef: txHash,
              network: "base",
              amountCents: PAYMENT_CONFIG.priceCents,
            },
          });
          console.log("[Base] Credit created successfully");
          setPaymentStatus("complete");
          onPaymentComplete(txHash);
        } catch (err) {
          console.error("[Base] Failed to create credit:", err);
          // Still complete payment - tx is on chain, we just failed to record it
          // This is a rare edge case, user can contact support with tx hash
          setPaymentStatus("complete");
          onPaymentComplete(txHash);
        }
      })();
    }
  }, [isConfirmed, txHash, onPaymentComplete]);

  const isTestMode = isPaymentTestMode();

  // Reset state when modal closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("select-method");
      setPaymentStatus("idle");
      resetWriteContract(); // Reset wagmi error state
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
          BigInt(PAYMENT_CONFIG.priceUsdcAtomic),
        ],
        chain: base, // Pass chain object instead of chainId
      });
    } catch (err) {
      console.error("[Base] Payment error:", err);
      setPaymentStatus("error");
    }
  };

  // Wallet UI hooks for Solana
  const { account: solanaAccount, wallets, connect } = useWalletUi();
  
  // Filter to only Phantom wallet
  const phantomWallets = wallets.filter(w => w.name.toLowerCase().includes('phantom'));

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
            onClick={async () => {
              const testTxHash = `test_tx_${Date.now()}`;
              try {
                // Create credit even in test mode
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (createCredit as any)({
                  data: {
                    paymentMethod: "free",
                    paymentRef: testTxHash,
                    network: "test",
                    amountCents: PAYMENT_CONFIG.priceCents,
                  },
                });
                console.log("[Test] Credit created");
              } catch (err) {
                console.error("[Test] Failed to create credit:", err);
              }
              onPaymentComplete(testTxHash);
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
              {/* Credit Card - Stripe */}
              <Button
                variant="outline"
                className="h-14 w-full justify-start gap-3"
                onClick={() => setStep("pay-stripe")}
              >
                <span className="text-xl">💳</span>
                <div className="text-left">
                  <div className="font-medium">Pay with Credit Card</div>
                  <div className="text-xs text-muted-foreground">
                    Visa, Mastercard, Amex
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
                    {PAYMENT_CONFIG.priceDisplay} USDC • Low fees
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
                    {PAYMENT_CONFIG.priceDisplay} USDC • Phantom
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
                (() => {
                  const errorInfo = getPaymentErrorMessage(error);
                  return (
                    <div className={`rounded-lg p-4 text-center ${errorInfo.isCancelled ? "bg-muted" : "bg-red-50 dark:bg-red-900/20"}`}>
                      <p className={`font-medium ${errorInfo.isCancelled ? "text-foreground" : "text-red-800 dark:text-red-200"}`}>
                        {errorInfo.title}
                      </p>
                      <p className={`mt-1 text-sm ${errorInfo.isCancelled ? "text-muted-foreground" : "text-red-600 dark:text-red-300"}`}>
                        {errorInfo.message}
                      </p>
                      <Button
                        variant={errorInfo.isCancelled ? "default" : "outline"}
                        className="mt-3"
                        onClick={() => {
                          setPaymentStatus("idle");
                          resetWriteContract();
                        }}
                      >
                        Try Again
                      </Button>
                    </div>
                  );
                })()
              ) : (
                <>
                  {/* Price */}
                  <div className="rounded-lg border bg-muted/50 p-4 text-center">
                    <p className="text-3xl font-bold">{PAYMENT_CONFIG.priceDisplay} USDC</p>
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
                                  : `Pay ${PAYMENT_CONFIG.priceDisplay} USDC`}
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
                    resetWriteContract();
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
                <div className="rounded-lg bg-muted p-4 text-center">
                  <p className="font-medium text-foreground">
                    Transaction Cancelled
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You cancelled the transaction. Click below to try again.
                  </p>
                  <Button
                    className="mt-3"
                    onClick={() => setPaymentStatus("idle")}
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <>
                  {/* Price */}
                  <div className="rounded-lg border bg-muted/50 p-4 text-center">
                    <p className="text-3xl font-bold">{PAYMENT_CONFIG.priceDisplay} USDC</p>
                    <p className="text-sm text-muted-foreground">on Solana</p>
                  </div>

                  {/* Connect or Pay Button */}
                  {!solanaAccount ? (
                    <PhantomConnectButton 
                      phantomWallets={phantomWallets}
                      onConnect={connect}
                    />
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

        {/* Step: Pay with Stripe (Credit Card) */}
        {step === "pay-stripe" && (
          <>
            <DialogHeader>
              <DialogTitle>Pay with Credit Card</DialogTitle>
              <DialogDescription>
                Pay ${PAYMENT_CONFIG.priceDisplay} via Stripe
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
                    Something went wrong. Please try again.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() => setPaymentStatus("idle")}
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <>
                  {/* Price */}
                  <div className="rounded-lg border bg-muted/50 p-4 text-center">
                    <p className="text-3xl font-bold">${PAYMENT_CONFIG.priceDisplay}</p>
                    <p className="text-sm text-muted-foreground">via Credit Card</p>
                  </div>

                  {/* Pay Button */}
                  <Button
                    onClick={async () => {
                      setPaymentStatus("processing");
                      try {
                        // Send call data to Stripe checkout so webhook can create the call
                        const response = await fetch("/api/stripe/checkout", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            callData: {
                              recipientName: callDetails.recipientName,
                              phoneNumber: callDetails.phoneNumber,
                              targetGender: callDetails.targetGender,
                              targetGenderCustom: callDetails.targetGenderCustom,
                              targetAgeRange: callDetails.targetAgeRange,
                              interestingPiece: callDetails.interestingPiece,
                              videoStyle: callDetails.videoStyle,
                              anythingElse: callDetails.anythingElse,
                            },
                          }),
                        });
                        
                        if (!response.ok) {
                          const error = await response.json();
                          throw new Error(error.error || "Failed to create checkout");
                        }
                        
                        const { checkoutUrl } = await response.json();
                        
                        // Redirect to Stripe Checkout
                        window.location.href = checkoutUrl;
                      } catch (err) {
                        console.error("[Stripe] Error:", err);
                        setPaymentStatus("error");
                      }
                    }}
                    disabled={paymentStatus === "processing"}
                    className="h-12 w-full text-lg"
                  >
                    {paymentStatus === "processing" ? "Redirecting to Stripe..." : `Pay $${PAYMENT_CONFIG.priceDisplay}`}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    Secure payment powered by Stripe
                  </p>
                </>
              )}

              {paymentStatus !== "complete" && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setStep("select-method");
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
