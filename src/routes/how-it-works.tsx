import { createFileRoute } from "@tanstack/react-router"
import { Header } from "~/components/header"
import { Footer } from "~/components/footer"
import { Button } from "~/components/ui/button"
import { Link } from "@tanstack/react-router"

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
})

function HowItWorksPage() {
  const steps = [
    {
      number: 1,
      title: "Choose Your Caller",
      description: "Browse our collection of AI callers, each with unique personalities and speaking styles. Select the one that fits your prank call needs.",
    },
    {
      number: 2,
      title: "Fill Out the Form",
      description: "Provide details about the recipient, including their name, phone number, and any personalization details you want the AI to use.",
    },
    {
      number: 3,
      title: "Make Payment",
      description: "Complete your payment securely using crypto (Base USDC, Solana USDC, ZCash) or traditional payment methods like Stripe.",
    },
    {
      number: 4,
      title: "AI Makes the Call",
      description: "Our AI system places the call and engages in a natural conversation using the caller's personality and your provided details.",
    },
    {
      number: 5,
      title: "Get Your Video",
      description: "After the call completes, you'll receive a generated video of the conversation that you can download and share.",
    },
  ]

  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto max-w-4xl p-6">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">How It Works</h1>
            <p className="text-xl text-muted-foreground">
              Create personalized AI prank calls in just a few simple steps
            </p>
          </div>

          <div className="space-y-8">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="flex gap-6"
              >
                <div className="flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
                    {step.number}
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold mb-2">{step.title}</h2>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link to="/create">
              <Button size="lg">Create Your First Call</Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

