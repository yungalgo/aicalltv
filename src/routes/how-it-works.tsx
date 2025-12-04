import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Navbar } from "~/components/navbar"
import { Footer } from "~/components/footer"
import { Button } from "~/components/ui/button"
import { AuthModal } from "~/components/auth-modal"
import { authQueryOptions } from "~/lib/auth/queries"

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
})

function HowItWorksPage() {
  const { data: user } = useQuery(authQueryOptions())
  const [showAuthModal, setShowAuthModal] = useState(false)

  const handleCreateCall = () => {
    if (user) {
      window.location.href = "/create"
    } else {
      setShowAuthModal(true)
    }
  }

  const steps = [
    {
      number: 1,
      title: "pick your caller",
      description: "browse our collection of ai callers - each with unique personalities, voices, and vibes. comedians, celebrities, original characters. pick the perfect one for your prank.",
    },
    {
      number: 2,
      title: "fill in the details (with near ai)",
      description: "our near ai-powered assistant helps you fill in call details through natural conversation. just chat and it extracts what it needs - recipient name, phone, personalization. you can also enable fhenix fhe encryption to protect phone numbers on-chain.",
    },
    {
      number: 3,
      title: "pay with crypto or card",
      description: "web3-native payments: usdc on base or solana, zcash shielded transactions for privacy, ztarknet testnet (free!), or just regular stripe/credit card. your choice.",
    },
    {
      number: 4,
      title: "ai makes the call",
      description: "our ai system places the call and engages in natural, hilarious conversation using the caller's unique personality. real-time speech synthesis and conversation ai create an authentic experience.",
    },
    {
      number: 5,
      title: "video emailed instantly",
      description: "within 5-15 minutes, a generated video is emailed to you. you can also view and download all your videos in the 'your calls' section once logged in. share it, watch your friends' reactions!",
    },
  ]

  return (
    <div className="flex min-h-svh flex-col pb-24"> {/* padding for fixed footer */}
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto max-w-4xl p-6">
          <div className="rounded-2xl border-2 p-8" style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A' }}>
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold mb-4" style={{ color: '#1A1A1A' }}>how it works</h1>
              <p className="text-xl" style={{ color: '#1A1A1A' }}>
                prank call your friends with ai and get a video instantly
              </p>
            </div>

            <div className="space-y-8">
              {steps.map((step, index) => (
                <div
                  key={step.number}
                  className="flex gap-6"
                >
                  <div className="flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full font-bold text-lg border-2" style={{ backgroundColor: '#1A1A1A', borderColor: '#1A1A1A', color: '#fffcf2' }}>
                      {step.number}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold mb-2" style={{ color: '#1A1A1A' }}>{step.title}</h2>
                    <p style={{ color: '#1A1A1A', opacity: 0.7 }}>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Button 
                size="lg" 
                className="font-medium hover:opacity-90"
                style={{ backgroundColor: '#86EE02', color: '#1A1A1A' }}
                onClick={handleCreateCall}
              >
                Prank your Friend
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        initialMode="login"
      />
    </div>
  )
}

