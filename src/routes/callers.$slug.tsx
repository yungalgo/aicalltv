import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useSuspenseQuery, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Navbar } from "~/components/navbar"
import { Footer } from "~/components/footer"
import { Button } from "~/components/ui/button"
import { Link } from "@tanstack/react-router"
import { AuthModal } from "~/components/auth-modal"
import { authQueryOptions } from "~/lib/auth/queries"

export const Route = createFileRoute("/callers/$slug")({
  component: CallerDetailPage,
})

function CallerDetailPage() {
  const { slug } = Route.useParams()
  const navigate = useNavigate()
  const { data: user } = useSuspenseQuery(authQueryOptions())
  const [showAuthModal, setShowAuthModal] = useState(false)
  
  // Fetch caller details from dedicated API endpoint
  const { data: caller } = useSuspenseQuery({
    queryKey: ["caller", slug],
    queryFn: async () => {
      const res = await fetch(`/api/callers/${slug}`)
      if (!res.ok) throw new Error("Failed to fetch caller")
      return res.json()
    },
  })
  
  // Handle "Use this caller" button click
  const handleUseCaller = () => {
    if (user) {
      // User is authenticated, go directly to create page with caller pre-selected
      navigate({ to: "/create", search: { caller: slug } })
    } else {
      // User not authenticated, save caller selection and show auth modal
      sessionStorage.setItem("selectedCallerSlug", slug)
      setShowAuthModal(true)
    }
  }
  
  // Handle successful auth - redirect to create with saved caller
  // Note: We keep the caller in sessionStorage and let the form read it
  // because better-auth might do a hard redirect that loses search params
  const handleAuthSuccess = () => {
    setShowAuthModal(false)
    // Don't remove sessionStorage here - let the form read it and clear it
    // Navigate to create - the form will read from sessionStorage if search params are lost
    navigate({ to: "/create" })
  }

  if (!caller) {
    return (
      <div className="flex min-h-svh flex-col">
        <Navbar />
        <div className="container mx-auto max-w-4xl p-6">
          <h1 className="text-3xl font-bold mb-4">Caller Not Found</h1>
          <p className="text-muted-foreground">The caller you're looking for doesn't exist.</p>
          <Link to="/">
            <Button className="mt-4">Go Home</Button>
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto max-w-4xl p-6">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Caller Image */}
            <div className="flex items-center justify-center">
              <img
                src={caller.imageUrl || caller.defaultImageUrl}
                alt={caller.name}
                className="w-full max-w-md rounded-lg object-cover"
              />
            </div>

            {/* Caller Info */}
            <div className="space-y-6">
              <div>
                <h1 className="text-4xl font-bold mb-2">{caller.name}</h1>
                <p className="text-xl text-muted-foreground">{caller.tagline}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Personality</h2>
                  <p className="text-muted-foreground">
                    {caller.personality || "A unique AI caller ready to make your prank call."}
                  </p>
                </div>

                <div>
                  <h2 className="text-lg font-semibold mb-2">Speaking Style</h2>
                  <p className="text-muted-foreground">
                    {caller.speakingStyle || "Natural and engaging conversation style."}
                  </p>
                </div>

                {caller.appearanceDescription && (
                <div>
                    <h2 className="text-lg font-semibold mb-2">Appearance</h2>
                    <p className="text-muted-foreground">
                      {caller.appearanceDescription}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <span className="inline-block px-3 py-1 rounded-full bg-muted text-sm">
                    {caller.gender}
                  </span>
                  {caller.voiceName && (
                    <span className="inline-block px-3 py-1 rounded-full bg-muted text-sm">
                      Voice: {caller.voiceName}
                    </span>
                  )}
                </div>
              </div>

              <Button 
                size="lg" 
                className="w-full md:w-auto"
                onClick={handleUseCaller}
              >
                Use This Caller
                </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onAuthSuccess={handleAuthSuccess}
        initialMode="signup"
      />
    </div>
  )
}

