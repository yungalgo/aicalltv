import { Link } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { CheckIcon } from "@radix-ui/react-icons";
import { PAYMENT_CONFIG } from "~/lib/web3/config";

export function HomePricing() {
  const features = [
    "AI-powered conversation",
    "Personalized caller selection",
    "HD video generation",
    "Downloadable video file",
    "No subscription required",
  ];

  return (
    <section id="pricing" className="py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl text-center mb-12">
          <h4 className="text-muted-foreground mb-2 font-medium tracking-tight">
            Pricing
          </h4>
          <h2 className="text-3xl font-bold mb-4">
            Simple, one-time pricing.
          </h2>
          <p className="text-muted-foreground text-lg">
            Pay once per call. No subscriptions, no hidden fees.
          </p>
        </div>

        <div className="flex justify-center">
          <div className="w-full max-w-md rounded-2xl border-2 border-primary shadow-lg p-8 bg-card">
            <div className="text-center mb-6">
              <div className="text-4xl font-bold mb-2">
                ${PAYMENT_CONFIG.priceUSD}
              </div>
              <div className="text-muted-foreground mb-4">per call</div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>or {PAYMENT_CONFIG.priceDisplay} USDC (Base/Solana)</div>
                <div>or {PAYMENT_CONFIG.priceZEC} ZEC (≈${PAYMENT_CONFIG.priceUSD})</div>
                <div className="text-xs pt-1">or 0.01 ZTF on Ztarknet (free testnet)</div>
              </div>
            </div>

            <ul className="space-y-3 mb-8">
              {features.map((feature, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-3 text-sm"
                >
                  <CheckIcon className="bg-primary text-primary-foreground size-4 shrink-0 rounded-full p-[2px]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Button asChild size="lg" className="w-full">
              <Link to="/create">Create a Call</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

