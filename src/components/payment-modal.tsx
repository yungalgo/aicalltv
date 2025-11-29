"use client";

import { useState } from "react";
import { PayEmbed } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { thirdwebClient } from "~/lib/thirdweb/client";
import {
  PAYMENT_CONFIG,
  isThirdwebConfigured,
  isPaymentTestMode,
} from "~/lib/thirdweb/config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

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
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "processing" | "complete" | "error"
  >("idle");

  const isConfigured = isThirdwebConfigured();
  const isTestMode = isPaymentTestMode();

  // Test mode OR not configured - show a bypass button for development
  if (isTestMode || !isConfigured || !thirdwebClient) {
    const reason = isTestMode 
      ? "Test mode is enabled" 
      : "Payment gateway not configured";
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>🧪 Test Mode Payment</DialogTitle>
            <DialogDescription>
              {reason}. Click below to simulate a successful payment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>{reason}</strong>
                <br />
                This will create a call without charging.
              </p>
            </div>

            <div className="text-center">
              <p className="text-2xl font-bold">${PAYMENT_CONFIG.priceUSD}</p>
              <p className="text-sm text-muted-foreground">
                AI Call to {callDetails.recipientName}
              </p>
            </div>

            <Button
              onClick={() => {
                const testTxHash = `test_tx_${Date.now()}`;
                console.log("[Payment] Test mode - simulating success:", testTxHash);
                setPaymentStatus("complete");
                onPaymentComplete(testTxHash);
              }}
              className="w-full h-12 text-lg"
              size="lg"
            >
              🧪 Simulate Payment (Test)
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Set VITE_PAYMENT_TEST_MODE=false to enable real payments
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Real payment mode - only reached if thirdweb is configured and not in test mode
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
          <DialogDescription>
            Pay ${PAYMENT_CONFIG.priceUSD} to request a call to{" "}
            {callDetails.recipientName}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {paymentStatus === "complete" ? (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
              <p className="text-green-800 dark:text-green-200 font-medium">
                ✓ Payment Complete!
              </p>
              <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                Your call request is being processed.
              </p>
            </div>
          ) : paymentStatus === "error" ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
              <p className="text-red-800 dark:text-red-200 font-medium">
                Payment Failed
              </p>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                Please try again.
              </p>
            </div>
          ) : (
            <PayEmbed
              client={thirdwebClient}
              payOptions={{
                mode: "direct_payment",
                paymentInfo: {
                  amount: PAYMENT_CONFIG.priceUSDC,
                  chain: base, // Base has low fees
                  token: {
                    address: PAYMENT_CONFIG.tokens.base,
                    name: "USD Coin",
                    symbol: "USDC",
                  },
                  sellerAddress: PAYMENT_CONFIG.sellerAddress,
                },
                metadata: {
                  name: `AI Call to ${callDetails.recipientName}`,
                  description: "AI-powered phone call with video generation",
                  image: "/favicon.ico",
                },
                purchaseData: {
                  productType: "ai_call",
                  recipientName: callDetails.recipientName,
                },
                // Crypto-only: disable fiat onramp (credit card redirects to MoonPay etc)
                buyWithFiat: false,
                onPurchaseSuccess: (info) => {
                  console.log("[Payment] Success:", info);
                  setPaymentStatus("complete");
                  const txHash =
                    (info as { transactionHash?: string })?.transactionHash ||
                    "tx_" + Date.now();
                  onPaymentComplete(txHash);
                },
              }}
              theme="dark"
            />
          )}
        </div>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          <p>Pay with crypto wallet</p>
          <p className="text-xs mt-1">9 USDC on Base</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
