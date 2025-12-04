import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "~/components/navbar";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      <div className="container mx-auto max-w-3xl p-6">
        <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-muted-foreground mb-4">
            Last updated: {new Date().toLocaleDateString()}
          </p>
          
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using aicall.tv, you accept and agree to be bound by the terms and provision of this agreement.
          </p>

          <h2>2. Use License</h2>
          <p>
            Permission is granted to temporarily use aicall.tv for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
          </p>
          <ul>
            <li>modify or copy the materials</li>
            <li>use the materials for any commercial purpose</li>
            <li>attempt to decompile or reverse engineer any software</li>
            <li>remove any copyright or other proprietary notations</li>
          </ul>

          <h2>3. Service Description</h2>
          <p>
            aicall.tv provides AI-powered prank call services. Each call is charged at $5 per call. Users may have free call credits available.
          </p>

          <h2>4. User Responsibilities</h2>
          <p>
            Users are responsible for providing accurate information and ensuring they have proper authorization to make calls to the phone numbers provided.
          </p>

          <h2>5. Limitation of Liability</h2>
          <p>
            aicall.tv shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.
          </p>
        </div>
      </div>
    </div>
  );
}

