"use client";

import { useState } from "react";
import { CheckoutWidget } from "thirdweb/react";
import { polygon } from "thirdweb/chains";
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

  // Test mode - show a bypass button for development
  if (isTestMode) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>🧪 Test Mode Payment</DialogTitle>
            <DialogDescription>
              Payment test mode is enabled. Click below to simulate a successful
              payment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Test Mode Active</strong>
                <br />
                Real payments are disabled. This will create a call without
                charging.
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

  // Not configured - show setup instructions
  if (!isConfigured) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Payment Configuration Required</DialogTitle>
            <DialogDescription>
              thirdweb is not configured. Please set VITE_THIRDWEB_CLIENT_ID and
              VITE_THIRDWEB_SELLER_ADDRESS in your environment.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Or set VITE_PAYMENT_TEST_MODE=true to test without real payments.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Real payment mode
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
            <CheckoutWidget
              client={thirdwebClient}
              chain={polygon}
              amount={PAYMENT_CONFIG.priceUSDC}
              seller={PAYMENT_CONFIG.sellerAddress}
              name={`AI Call to ${callDetails.recipientName}`}
              description="AI-powered phone call with video generation"
              image="/favicon.ico"
              purchaseData={{
                productType: "ai_call",
                recipientName: callDetails.recipientName,
              }}
              onSuccess={(result) => {
                console.log("[Payment] Success:", result);
                setPaymentStatus("complete");
                const txHash =
                  result?.statuses?.[0]?.transactions?.[0]?.transactionHash ||
                  "tx_" + Date.now();
                onPaymentComplete(txHash);
              }}
              theme="dark"
            />
          )}
        </div>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          <p>Pay with credit card or crypto wallet</p>
          <p className="text-xs mt-1">Powered by thirdweb</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
