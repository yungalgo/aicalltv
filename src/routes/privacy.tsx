import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "~/components/navbar";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      <div className="container mx-auto max-w-3xl p-6">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-muted-foreground mb-4">
            Last updated: {new Date().toLocaleDateString()}
          </p>
          
          <h2>1. Information We Collect</h2>
          <p>
            We collect information that you provide directly to us, including:
          </p>
          <ul>
            <li>Name and email address (for account creation)</li>
            <li>Phone numbers (encrypted before storage)</li>
            <li>Call context and messages</li>
            <li>Payment information (processed securely)</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>
            We use the information we collect to:
          </p>
          <ul>
            <li>Provide, maintain, and improve our services</li>
            <li>Process your call requests</li>
            <li>Send you technical notices and support messages</li>
            <li>Respond to your comments and questions</li>
          </ul>

          <h2>3. Data Security</h2>
          <p>
            We implement appropriate technical and organizational security measures to protect your personal information. Phone numbers are encrypted using Fhenix CoFHE encryption before storage.
          </p>

          <h2>4. Data Retention</h2>
          <p>
            We retain your personal information for as long as necessary to provide our services and comply with legal obligations.
          </p>

          <h2>5. Your Rights</h2>
          <p>
            You have the right to access, update, or delete your personal information at any time by contacting us.
          </p>

          <h2>6. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us.
          </p>
        </div>
      </div>
    </div>
  );
}

