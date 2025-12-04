import { createFileRoute, redirect } from "@tanstack/react-router";
import { Navbar } from "~/components/navbar";
import { Footer } from "~/components/footer";
import { CallRequestForm } from "~/components/call-request-form";
import { authQueryOptions } from "~/lib/auth/queries";
import { Suspense } from "react";

export const Route = createFileRoute("/create")({
  component: CreateCallPage,
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(authQueryOptions());
    if (!user) {
      throw redirect({ to: "/signup" });
    }
  },
});

function CreateCallPage() {
  const search = Route.useSearch();
  const callerSlug = (search as { caller?: string }).caller;

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

          <Suspense fallback={<div className="py-6">Loading form...</div>}>
            <CallRequestForm />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}
