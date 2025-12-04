import { createFileRoute, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { Navbar } from "~/components/navbar";
import { Footer } from "~/components/footer";
import { CallsTable } from "~/components/calls-table";
import { authQueryOptions } from "~/lib/auth/queries";
import { useSuspenseQuery } from "@tanstack/react-query";

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
  useSuspenseQuery(authQueryOptions()); // Ensure user is loaded

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Calls</h1>
          <p className="text-muted-foreground">
            View and manage all your AI call requests
          </p>
        </div>
        <Suspense fallback={<div className="rounded-lg border p-8 text-center">Loading...</div>}>
          <CallsTable />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
