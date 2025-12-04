import { createFileRoute, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { Navbar } from "~/components/navbar";
import { Footer } from "~/components/footer";
import { CallsTable } from "~/components/calls-table";
import { authQueryOptions } from "~/lib/auth/queries";
import { useQuery } from "@tanstack/react-query";
import { LogoSpinner } from "~/components/logo";

export const Route = createFileRoute("/your-calls")({
  component: YourCallsPage,
  beforeLoad: async ({ context }) => {
    // Ensure user is authenticated
    const user = await context.queryClient.ensureQueryData({
      ...authQueryOptions(),
      revalidateIfStale: true,
    });
    if (!user) {
      throw redirect({ to: "/login" });
    }
  },
});


function YourCallsPage() {
  const { isLoading } = useQuery(authQueryOptions());

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-6xl">
        <div className="rounded-2xl border-2 p-8" style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A' }}>
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#1A1A1A' }}>Your Calls</h1>
            <p style={{ color: '#1A1A1A', opacity: 0.7 }}>
              View and manage all your AI call requests
            </p>
          </div>
          <Suspense fallback={<div className="flex items-center justify-center py-12"><LogoSpinner size="md" /></div>}>
            <CallsTable />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}
