import { createFileRoute, redirect } from "@tanstack/react-router"
import { Navbar } from "~/components/navbar"
import { Footer } from "~/components/footer"
import { CallsTable } from "~/components/calls-table"
import { authQueryOptions } from "~/lib/auth/queries"
import { Suspense } from "react"

export const Route = createFileRoute("/calls")({
  component: CallsPage,
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(authQueryOptions())
    if (!user) {
      throw redirect({ to: "/login" })
    }
  },
})

function CallsPage() {
  return (
    <div className="flex min-h-svh flex-col pb-24">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto max-w-6xl p-6">
          <h1 className="text-3xl font-bold mb-6" style={{ color: '#1A1A1A' }}>My Calls</h1>
          
          <Suspense fallback={<div className="py-6" style={{ color: '#1A1A1A' }}>Loading your calls...</div>}>
            <CallsTable />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

