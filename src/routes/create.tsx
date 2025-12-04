import { createFileRoute, redirect } from "@tanstack/react-router"
import { Navbar } from "~/components/navbar"
import { Footer } from "~/components/footer"
import { authQueryOptions } from "~/lib/auth/queries"

export const Route = createFileRoute("/create")({
  component: CreateCallPage,
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(authQueryOptions())
    if (!user) {
      throw redirect({ to: "/signup" })
    }
  },
})

function CreateCallPage() {
  const search = Route.useSearch()
  const callerSlug = (search as { caller?: string }).caller

  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto max-w-4xl p-6">
          <h1 className="text-3xl font-bold mb-6">Create a Prank Call</h1>
          
          {callerSlug && (
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Selected caller: <span className="font-semibold">{callerSlug}</span>
              </p>
            </div>
          )}

          <div className="bg-card border rounded-lg p-6">
            <p className="text-muted-foreground">
              Call request form will be integrated here. This page is currently a stub.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              The form from the homepage will be moved here.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
