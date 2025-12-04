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
import baseIconUrl from "~/assets/payment-icons/base-icon.svg";
import solanaIconUrl from "~/assets/payment-icons/solana-icon.svg";
import zcashIconUrl from "~/assets/payment-icons/zcash-icon.svg";
import ztarknetIconUrl from "~/assets/payment-icons/ztarknet-icon.svg";
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
import { ZtarknetProvider } from "./ztarknet-provider";
import { ZtarknetPayment } from "./ztarknet-payment";
import { toast } from "sonner";

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

type PaymentStep = "select-method" | "select-crypto" | "pay-base" | "pay-solana" | "pay-stripe" | "pay-zcash" | "pay-starknet";

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
    callerId?: string;
    targetGender?: string;
    targetGenderCustom?: string;
    targetAgeRange?: string;
    // New personalization fields
    targetCity?: string;
    targetHobby?: string;
    targetProfession?: string;
    interestingPiece?: string;
    ragebaitTrigger?: string;
    videoStyle?: string;
    // Optional uploaded image
    uploadedImageUrl?: string;
    uploadedImageS3Key?: string;
    // Fhenix FHE encryption
    fhenixEnabled?: boolean;
    fhenixVaultId?: string;
  };
}

// Phantom connect button component
function PhantomConnectButton({
  phantomWallets,
  onConnect,
  connect,
  currentAccount,
}: {
  phantomWallets: ReturnType<typeof useWalletUi>['wallets'];
  onConnect: (account: UiWalletAccount) => void;
  connect: ReturnType<typeof useWalletUi>['connect'];
  currentAccount: UiWalletAccount | null | undefined;
}) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (phantomWallets.length === 0) {
      window.open("https://phantom.app/", "_blank");
      return;
    }

    const phantom = phantomWallets[0];
    setIsConnecting(true);
    setError(null);
    
    try {
      console.log("[Phantom] Attempting to connect...", { 
        wallet: phantom.name, 
        walletId: (phantom as any).id,
        features: Object.keys(phantom.features || {}),
        featureDetails: phantom.features ? Object.keys(phantom.features).map(key => ({
          key,
          type: typeof (phantom.features as any)[key],
          hasConnect: typeof (phantom.features as any)[key]?.connect === 'function'
        })) : [],
        hasConnect: !!connect
      });
      
      // Try using the standard:connect feature directly first (more reliable)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connectFeature = (phantom.features as any)?.['standard:connect'];
      console.log("[Phantom] connectFeature check:", {
        exists: !!connectFeature,
        type: typeof connectFeature,
        hasConnect: typeof connectFeature?.connect === 'function'
      });
      
      if (connectFeature && typeof connectFeature.connect === 'function') {
        console.log("[Phantom] Using standard:connect feature");
        try {
          const result = await connectFeature.connect();
          console.log("[Phantom] Connect result:", result);
          if (result?.accounts && result.accounts.length > 0) {
            const account = result.accounts[0] as UiWalletAccount;
            console.log("[Phantom] ✅ Connected account:", account.address);
            onConnect(account);
            // Also try to sync with useWalletUi's connect function
            if (connect) {
              try {
                // connect expects a UiWalletAccount, but we have the account from standard:connect
                await connect(account);
                console.log("[Phantom] ✅ Synced with useWalletUi");
              } catch (syncErr) {
                console.warn("[Phantom] Sync with useWalletUi failed (non-critical):", syncErr);
              }
            }
            return;
          } else {
            throw new Error("No accounts returned from wallet connection");
          }
        } catch (featureErr) {
          console.error("[Phantom] standard:connect failed:", featureErr);
          // Fall through to try useWalletUi connect
        }
      } else {
        console.log("[Phantom] standard:connect feature not available, trying useWalletUi connect");
      }
      
      // Fallback: Try using Phantom's native Solana provider directly
      // According to Phantom docs: https://phantom-e50e2e68.mintlify.app/solana/establishing-a-connection
      const phantomProvider = (window as any).solana;
      if (phantomProvider && phantomProvider.isPhantom) {
        console.log("[Phantom] Using native Phantom provider");
        try {
          // Use Phantom's native connect() method
          const response = await phantomProvider.connect();
          console.log("[Phantom] Native connect() response:", response);
          
          if (response?.publicKey) {
            // Convert Phantom's PublicKey to our UiWalletAccount format
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const account = {
              address: response.publicKey.toBase58(),
              chains: [],
              icon: phantom.icon,
              label: phantom.name,
            } as any as UiWalletAccount;
            console.log("[Phantom] ✅ Connected via native provider:", account.address);
            onConnect(account);
            
            // Also try to sync with useWalletUi's connect function if available
            if (connect) {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (connect as any)(phantom);
                console.log("[Phantom] ✅ Synced with useWalletUi");
              } catch (syncErr) {
                console.warn("[Phantom] Sync with useWalletUi failed (non-critical):", syncErr);
              }
            }
            return;
          } else {
            throw new Error("No public key returned from Phantom connection");
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error 
            ? (err as Error).message 
            : typeof err === 'string' 
              ? err 
              : 'Unknown error';
          console.error("[Phantom] Native connect() failed:", errorMessage);
          throw new Error(`Connection failed: ${errorMessage}`);
        }
      }
      
      // Last fallback: Try using the connect function from useWalletUi
      if (connect) {
        console.log("[Phantom] Using connect function from useWalletUi as last resort");
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (connect as any)(phantom);
          console.log("[Phantom] connect() result:", result);
          
          // Wait a moment for the account to be set by the hook
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Check if account was set
          const accountAddress = currentAccount?.address;
          if (accountAddress && currentAccount) {
            console.log("[Phantom] ✅ Account set via useWalletUi:", accountAddress);
            onConnect(currentAccount);
            return;
          } else {
            console.warn("[Phantom] ⚠️ Account not set after connect()");
            // Check if there's a result with accounts
            if (result?.accounts && result.accounts.length > 0) {
              const account = result.accounts[0] as UiWalletAccount;
              console.log("[Phantom] ✅ Got account from result:", account.address);
              onConnect(account);
              return;
            }
            throw new Error("Connection completed but no account was returned. Please try again.");
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error 
            ? (err as Error).message 
            : typeof err === 'string' 
              ? err 
              : 'Unknown error';
          console.error("[Phantom] connect() failed:", errorMessage);
          throw new Error(`Connection failed: ${errorMessage}`);
        }
      }
      
      // If neither method works, throw error
      throw new Error("Wallet connection method not available. Please ensure Phantom wallet is installed and unlocked, then refresh the page.");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to connect to Phantom wallet";
      console.error("[Phantom] Connect error:", err);
      setError(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-2">
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
      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
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
            paymentMethod: "sol_usdc",
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
              paymentMethod: "base_usdc",
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

  // Fetch test mode from server (controlled by TESTING_MODE env var)
  const [isTestMode, setIsTestMode] = useState(false);
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => setIsTestMode(data.testingMode))
      .catch(() => setIsTestMode(false));
  }, []);

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
  
  // Handle account connection callback (when using standard:connect feature)
  const handleSolanaConnect = (account: UiWalletAccount) => {
    console.log("[PaymentModal] Solana account connected via standard:connect:", account.address);
    // When using standard:connect, we get the account directly
    // But useWalletUi should also update automatically, so this is mainly for logging
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
                <img src={baseIconUrl} alt="Base" className="h-6 w-6 shrink-0 object-contain" />
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
                <img src={solanaIconUrl} alt="Solana" className="h-6 w-6 shrink-0 object-contain" />
                <div className="text-left">
                  <div className="font-medium">Pay on Solana</div>
                  <div className="text-xs text-muted-foreground">
                    {PAYMENT_CONFIG.priceDisplay} USDC • Phantom
                  </div>
                </div>
              </Button>

              {/* Ztarknet - Pay on Ztarknet L2 */}
              <Button
                variant="outline"
                className="h-14 w-full justify-start gap-3"
                onClick={() => setStep("pay-starknet")}
              >
                <img src={ztarknetIconUrl} alt="Ztarknet" className="h-6 w-6 shrink-0 object-contain" />
                <div className="text-left">
                  <div className="font-medium">Pay on Ztarknet</div>
                  <div className="text-xs text-muted-foreground">
                    0.01 ZTF • Settles to Zcash
                  </div>
                </div>
              </Button>

              {/* ZCash - Shielded Payments */}
              <Button
                variant="outline"
                className="h-14 w-full justify-start gap-3"
                onClick={() => setStep("pay-zcash")}
              >
                <img src={zcashIconUrl} alt="ZCash" className="h-6 w-6 shrink-0 object-contain" />
                <div className="text-left">
                  <div className="font-medium">Pay on ZCash</div>
                  <div className="text-xs text-muted-foreground">
                    {PAYMENT_CONFIG.priceZEC} ZEC (≈${PAYMENT_CONFIG.priceUSD}) • Shielded
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
                      onConnect={handleSolanaConnect}
                      connect={connect}
                      currentAccount={solanaAccount}
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
                      // Validate required fields before payment
                      if (!callDetails.callerId) {
                        toast.error("Please select a caller before proceeding");
                        return;
                      }
                      if (!callDetails.recipientName || !callDetails.phoneNumber) {
                        toast.error("Please fill in all required fields");
                        return;
                      }
                      
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
                              callerId: callDetails.callerId,
                              targetGender: callDetails.targetGender,
                              targetGenderCustom: callDetails.targetGenderCustom,
                              targetAgeRange: callDetails.targetAgeRange,
                              interestingPiece: callDetails.interestingPiece,
                              videoStyle: callDetails.videoStyle,
                              // Fhenix FHE encryption
                              fhenixEnabled: callDetails.fhenixEnabled,
                              fhenixVaultId: callDetails.fhenixVaultId,
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

        {/* Step: Pay with ZCash */}
        {step === "pay-zcash" && (
          <ZCashPaymentStep
            callDetails={callDetails}
            onPaymentComplete={async (txRef) => {
              // Create credit
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (createCredit as any)({
                  data: {
                    paymentMethod: "zcash",
                    paymentRef: txRef,
                    network: "zcash",
                    amountCents: PAYMENT_CONFIG.priceCents,
                  },
                });
                onPaymentComplete(txRef);
              } catch (err) {
                console.error("[ZCash] Failed to create credit:", err);
              }
            }}
            onBack={() => {
              setStep("select-crypto");
              setPaymentStatus("idle");
            }}
          />
        )}

        {/* Step: Pay with Ztarknet (ZTF on L2 that settles to Zcash) */}
        {step === "pay-starknet" && (
          <ZtarknetProvider>
            <ZtarknetPayment
              onPaymentComplete={async (txRef) => {
                // Create credit
                try {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  await (createCredit as any)({
                    data: {
                      paymentMethod: "ztarknet",
                      paymentRef: txRef,
                      network: "ztarknet",
                      amountCents: PAYMENT_CONFIG.priceCents,
                    },
                  });
                  onPaymentComplete(txRef);
                } catch (err) {
                  console.error("[Ztarknet] Failed to create credit:", err);
                  // Still complete - tx is on chain
                  onPaymentComplete(txRef);
                }
              }}
              onBack={() => {
                setStep("select-crypto");
                setPaymentStatus("idle");
              }}
            />
          </ZtarknetProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Note: StarknetPaymentStep has been replaced by ZtarknetPayment component
// which uses @starknet-react/core for proper wallet integration

// ZCash Payment Step Component
function ZCashPaymentStep({
  callDetails,
  onPaymentComplete,
  onBack,
}: {
  callDetails: PaymentModalProps["callDetails"];
  onPaymentComplete: (txRef: string) => void;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "polling" | "confirmed" | "timeout" | "error">("loading");
  const [paymentData, setPaymentData] = useState<{
    orderId: string;
    address: string;
    amount: string;
    memo: string;
    uri: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartRef = useRef<number | null>(null);
  const MAX_POLL_TIME = 90000; // 90 seconds max polling

  // Create payment request on mount
  useEffect(() => {
    async function createPayment() {
      try {
        const response = await fetch("/api/zcash/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formData: {
              recipientName: callDetails.recipientName,
              phoneNumber: callDetails.phoneNumber,
              targetGender: callDetails.targetGender,
              targetGenderCustom: callDetails.targetGenderCustom,
              targetAgeRange: callDetails.targetAgeRange,
              interestingPiece: callDetails.interestingPiece,
              videoStyle: callDetails.videoStyle,
            },
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create payment request");
        }

        const data = await response.json();
        setPaymentData(data);
        setStatus("ready");
      } catch (err) {
        console.error("[ZCash] Error creating payment:", err);
        setError(err instanceof Error ? err.message : "Failed to create payment");
        setStatus("error");
      }
    }

    createPayment();

    // Cleanup polling on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [callDetails]);

  // Start polling for payment
  const startPolling = () => {
    if (!paymentData) return;
    
    setStatus("polling");
    setPollCount(0);
    pollStartRef.current = Date.now();

    pollIntervalRef.current = setInterval(async () => {
      try {
        // Check timeout
        const elapsed = Date.now() - (pollStartRef.current || Date.now());
        if (elapsed > MAX_POLL_TIME) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          setStatus("timeout");
          return;
        }
        
        setPollCount(prev => prev + 1);
        
        const response = await fetch(
          `/api/zcash/payment?action=check&orderId=${paymentData.orderId}`
        );
        
        if (!response.ok) return;
        
        const result = await response.json();
        
        if (result.status === "confirmed") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          setStatus("confirmed");
          onPaymentComplete(paymentData.orderId);
        }
      } catch (err) {
        console.error("[ZCash] Polling error:", err);
      }
    }, 5000); // Poll every 5 seconds
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Pay with ZCash</DialogTitle>
        <DialogDescription>
          Scan with Zashi, YWallet, or any ZCash wallet
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-4">
        {status === "loading" && (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {status === "error" && (
          <div className="rounded-lg bg-red-50 p-4 text-center dark:bg-red-900/20">
            <p className="font-medium text-red-800 dark:text-red-200">
              {error || "Failed to create payment"}
            </p>
            <Button variant="outline" className="mt-3" onClick={onBack}>
              Go Back
            </Button>
          </div>
        )}

        {status === "confirmed" && (
          <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
            <p className="font-medium text-green-800 dark:text-green-200">
              ✓ Payment Confirmed!
            </p>
          </div>
        )}

        {status === "timeout" && paymentData && (
          <div className="rounded-lg bg-amber-50 p-4 text-center dark:bg-amber-900/20">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              ⏱ Confirmation Timeout
            </p>
            <p className="mt-1 text-sm text-amber-600 dark:text-amber-300">
              Payment not detected yet. ZCash transactions can take 1-2 minutes to confirm.
            </p>
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-mono">
              Memo: {paymentData.memo}
            </p>
            <Button 
              className="mt-3" 
              onClick={() => {
                setStatus("ready");
                setPollCount(0);
              }}
            >
              Check Again
            </Button>
          </div>
        )}

        {(status === "ready" || status === "polling") && paymentData && (
          <>
            {/* QR Code */}
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-4">
                {/* QR Code - using a simple placeholder, you can add qrcode.react */}
                <div className="flex h-48 w-48 items-center justify-center bg-white">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentData.uri)}`}
                    alt="ZCash Payment QR Code"
                    className="h-full w-full"
                  />
                </div>
              </div>

              {/* Amount */}
              <div className="text-center">
                <p className="text-2xl font-bold">{paymentData.amount} ZEC</p>
                <p className="text-sm text-muted-foreground">≈ ${PAYMENT_CONFIG.priceDisplay} USD</p>
              </div>

              {/* Address (truncated) */}
              <div className="w-full rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Send to:</p>
                <p className="break-all font-mono text-xs">
                  {paymentData.address.slice(0, 20)}...{paymentData.address.slice(-20)}
                </p>
              </div>

              {/* Memo */}
              <div className="w-full rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Memo (required):</p>
                <p className="font-mono text-sm">{paymentData.memo}</p>
              </div>
            </div>

            {/* Status */}
            {status === "polling" ? (
              <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Waiting for payment confirmation...
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Checking... ({pollCount} checks, ~{Math.round((Date.now() - (pollStartRef.current || Date.now())) / 1000)}s elapsed)
                </p>
                <p className="text-xs text-center text-muted-foreground">
                  ZCash transactions typically confirm in 30-90 seconds
                </p>
              </div>
            ) : (
              <Button onClick={startPolling} className="w-full">
                I&apos;ve Sent the Payment
              </Button>
            )}
          </>
        )}

        {status !== "confirmed" && (
          <Button variant="ghost" className="w-full" onClick={onBack}>
            ← Back
          </Button>
        )}
      </div>
    </>
  );
}
