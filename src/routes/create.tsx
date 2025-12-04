import { createFileRoute, redirect } from "@tanstack/react-router";
import { Navbar } from "~/components/navbar";
import { Footer } from "~/components/footer";
import { CallRequestForm } from "~/components/call-request-form";
import { authQueryOptions } from "~/lib/auth/queries";
import { Suspense } from "react";
import { Card } from "~/components/ui/card";

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
        <section className="container mx-auto py-16 max-w-4xl">
          <Card className="w-full p-6 lg:p-8">
            <div className="mb-6">
              <h3 className="text-2xl font-semibold">Create AI Call</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Fill in the details for your AI-powered prank call
              </p>
            </div>

            <Suspense fallback={<div className="py-6">Loading form...</div>}>
              <CallRequestForm />
            </Suspense>
          </Card>
        </section>
      </main>
      <Footer />
    </div>
  );
}
