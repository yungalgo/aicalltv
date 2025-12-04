import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Header } from "~/components/header"
import { Footer } from "~/components/footer"
import { Button } from "~/components/ui/button"
import { Link } from "@tanstack/react-router"

export const Route = createFileRoute("/callers/$slug")({
  component: CallerDetailPage,
})

function CallerDetailPage() {
  const { slug } = Route.useParams()
  
  // Fetch caller details
  const { data: caller } = useSuspenseQuery({
    queryKey: ["caller", slug],
    queryFn: async () => {
      const res = await fetch(`/api/callers`)
      if (!res.ok) throw new Error("Failed to fetch callers")
      const callers = await res.json()
      return callers.find((c: { slug: string }) => c.slug === slug)
    },
  })

  if (!caller) {
    return (
      <div className="flex min-h-svh flex-col">
        <Header />
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
      <Header />
      <main className="flex-1">
        <div className="container mx-auto max-w-4xl p-6">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Caller Image */}
            <div className="flex items-center justify-center">
              <img
                src={caller.defaultImageUrl}
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
                  <h2 className="text-lg font-semibold mb-2">About</h2>
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

                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-muted text-sm">
                    {caller.gender}
                  </span>
                </div>
              </div>

              <Link to="/create" search={{ caller: slug }}>
                <Button size="lg" className="w-full md:w-auto">
                  Select This Caller
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

