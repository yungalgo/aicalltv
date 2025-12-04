import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Navbar } from "~/components/navbar"
import { Footer } from "~/components/footer"
import { Button } from "~/components/ui/button"
import { AuthModal } from "~/components/auth-modal"
import { authQueryOptions } from "~/lib/auth/queries"
import { LogoSpinner } from "~/components/logo"

export const Route = createFileRoute("/callers/$slug")({
  component: CallerDetailPage,
})


function CallerDetailPage() {
  const { slug } = Route.useParams()
  const { data: user } = useQuery(authQueryOptions())
  const [showAuthModal, setShowAuthModal] = useState(false)
  
  // Fetch caller details from dedicated API endpoint
  const { data: caller, isLoading } = useQuery({
    queryKey: ["caller", slug],
    queryFn: async () => {
      const res = await fetch(`/api/callers/${slug}`)
      if (!res.ok) throw new Error("Failed to fetch caller")
      return res.json()
    },
  })
  
  // Handle "Use this caller" button click
  const handleUseCaller = () => {
    // Always save to sessionStorage so the form can read it
    sessionStorage.setItem("selectedCallerSlug", slug)
    
    if (user) {
      // User is authenticated, go directly to create page
      window.location.href = "/create"
    } else {
      // User not authenticated, show auth modal
      setShowAuthModal(true)
    }
  }
  
  // Handle successful auth - redirect to create with saved caller
  const handleAuthSuccess = () => {
    setShowAuthModal(false)
    // Navigate to create - the form will read caller from sessionStorage
    window.location.href = "/create"
  }

  if (isLoading) {
    return (
      <div className="flex min-h-svh flex-col pb-24">
        <Navbar />
        <main className="flex-1">
          <LogoSpinner fixed size="lg" />
        </main>
        <Footer />
      </div>
    )
  }

  if (!caller) {
    return (
      <div className="flex min-h-svh flex-col pb-24">
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
    <div className="flex min-h-svh flex-col pb-24">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto max-w-4xl p-6">
          <div className="rounded-2xl border-2 p-8" style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A' }}>
            <div className="grid gap-8 md:grid-cols-2">
              {/* Caller Image */}
              <div className="flex items-center justify-center">
                <img
                  src={caller.imageUrl || caller.defaultImageUrl}
                  alt={caller.name}
                  className="w-full max-w-md rounded-lg object-cover border-2" style={{ borderColor: '#1A1A1A' }}
                />
              </div>

              {/* Caller Info */}
              <div className="space-y-6">
                <div>
                  <h1 className="text-4xl font-bold mb-2" style={{ color: '#1A1A1A' }}>{caller.name}</h1>
                  <p className="text-xl" style={{ color: '#1A1A1A', opacity: 0.7 }}>{caller.tagline}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold mb-2" style={{ color: '#1A1A1A' }}>Personality</h2>
                    <p style={{ color: '#1A1A1A', opacity: 0.7 }}>
                      {caller.personality || "A unique AI caller ready to make your prank call."}
                    </p>
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold mb-2" style={{ color: '#1A1A1A' }}>Speaking Style</h2>
                    <p style={{ color: '#1A1A1A', opacity: 0.7 }}>
                      {caller.speakingStyle || "Natural and engaging conversation style."}
                    </p>
                  </div>

                  {caller.appearanceDescription && (
                  <div>
                      <h2 className="text-lg font-semibold mb-2" style={{ color: '#1A1A1A' }}>Appearance</h2>
                      <p style={{ color: '#1A1A1A', opacity: 0.7 }}>
                        {caller.appearanceDescription}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-block px-3 py-1 rounded-full text-sm text-white" style={{ backgroundColor: '#1A1A1A' }}>
                      {caller.gender}
                    </span>
                    {caller.voiceName && (
                      <span className="inline-block px-3 py-1 rounded-full text-sm text-white" style={{ backgroundColor: '#1A1A1A' }}>
                        Voice: {caller.voiceName}
                      </span>
                    )}
                  </div>
                </div>

                <Button 
                  size="lg" 
                  className="w-full md:w-auto font-medium hover:opacity-80"
                  onClick={handleUseCaller}
                  style={{ backgroundColor: '#1A1A1A', color: 'white' }}
                >
                  Use This Caller
                  </Button>
              </div>
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

