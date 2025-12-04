import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { CheckIcon } from "@radix-ui/react-icons";
import { PAYMENT_CONFIG } from "~/lib/web3/config";
import { authQueryOptions } from "~/lib/auth/queries";
import { AuthModal } from "~/components/auth-modal";

function CreateCallButton() {
  const { data: user } = useQuery(authQueryOptions());
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleClick = () => {
    if (user) {
      window.location.href = "/create";
    } else {
      setShowAuthModal(true);
    }
  };

  return (
    <>
      <div className="flex justify-center">
      <Button 
        onClick={handleClick}
        size="lg" 
          className="font-medium hover:opacity-80 px-12" 
        style={{ backgroundColor: '#1A1A1A', color: 'white' }}
      >
          Let's Do It
      </Button>
      </div>
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onAuthSuccess={() => {
          setShowAuthModal(false);
          window.location.href = "/create";
        }}
        initialMode="signup"
      />
    </>
  );
}

export function HomePricing() {
  const features = [
    "near ai-powered conversation assistant",
    "unique ai caller personalities",
    "video generated & emailed instantly",
    "web3 payments (base, solana, zcash, ztarknet)",
    "optional fhe encryption for privacy",
    "credit card also accepted",
  ];

  return (
    <section id="pricing" className="py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl text-center mb-12">
          <div className="inline-block rounded-2xl border-2 px-8 py-4" style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A' }}>
            <h4 className="mb-2 font-medium tracking-tight" style={{ color: '#1A1A1A', opacity: 0.7 }}>
              pricing
            </h4>
            <h2 className="text-3xl font-bold mb-4" style={{ color: '#1A1A1A' }}>
              simple, one-time pricing
            </h2>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="w-full max-w-md rounded-2xl border-2 shadow-lg p-8" style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A' }}>
            <div className="text-center mb-6">
              <div className="text-4xl font-bold mb-2" style={{ color: '#1A1A1A' }}>
                ${PAYMENT_CONFIG.priceUSD}
              </div>
              <div className="mb-4" style={{ color: '#1A1A1A', opacity: 0.7 }}>per prank call + video</div>
              <div className="text-sm space-y-1" style={{ color: '#1A1A1A', opacity: 0.7 }}>
                <div>or {PAYMENT_CONFIG.priceDisplay} usdc (base/solana)</div>
                <div>or {PAYMENT_CONFIG.priceZEC} zec (zcash shielded)</div>
                <div className="text-xs pt-1">or 0.01 ztf on ztarknet (free testnet!)</div>
              </div>
            </div>

            <ul className="space-y-3 mb-8">
              {features.map((feature, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-3 text-sm"
                  style={{ color: '#1A1A1A' }}
                >
                  <CheckIcon className="size-4 shrink-0 rounded-full p-[2px]" style={{ backgroundColor: '#1A1A1A', color: '#fffcf2' }} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <CreateCallButton />
          </div>
        </div>
      </div>
    </section>
  );
}

