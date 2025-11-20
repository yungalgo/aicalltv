import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { AuthModal } from "~/components/auth-modal";
import { Header } from "~/components/header";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "sonner";
import { authQueryOptions } from "~/lib/auth/queries";
import { createCall } from "~/lib/calls/functions";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <div className="container mx-auto max-w-2xl p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Request a Call</h1>
          <p className="text-muted-foreground mt-2">
            Fill out the form below to request an AI call. Pay-per-call pricing ($5 per call).
          </p>
        </div>

        <Suspense fallback={<div className="py-6">Loading...</div>}>
          <CallRequestForm />
        </Suspense>
      </div>
    </div>
  );
}

function CallRequestForm() {
  const { data: user } = useSuspenseQuery(authQueryOptions());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [formData, setFormData] = useState({
    recipientName: "",
    phoneNumber: "",
    recipientContext: "",
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Check if user is logged in - show modal instead of redirecting
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // Basic validation
    if (!formData.recipientName.trim()) {
      toast.error("Recipient name is required");
      return;
    }
    if (!formData.phoneNumber.trim()) {
      toast.error("Phone number is required");
      return;
    }
    if (!formData.recipientContext.trim()) {
      toast.error("Context/message is required");
      return;
    }
    if (formData.recipientContext.length > 1000) {
      toast.error("Context must be 1000 characters or less");
      return;
    }

    setIsSubmitting(true);

    try {
      // Dummy payment flow: Automatically uses web3_wallet payment method
      // Call server function - data must be wrapped in { data: ... }
      await (createCall as any)({
        data: {
          recipientName: formData.recipientName,
          phoneNumber: formData.phoneNumber,
          recipientContext: formData.recipientContext,
          paymentMethod: "web3_wallet",
          isFree: false,
        },
      });

      toast.success("Payment processed! Call request submitted for processing.");
      
      // Reset form
      setFormData({
        recipientName: "",
        phoneNumber: "",
        recipientContext: "",
      });
    } catch (error) {
      console.error("Error creating call:", error);
      toast.error("Failed to create call request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuthSuccess = async () => {
    // After successful auth, automatically submit the form
    if (formData.recipientName && formData.phoneNumber && formData.recipientContext) {
      setIsSubmitting(true);
      try {
        await (createCall as any)({
          data: {
            recipientName: formData.recipientName,
            phoneNumber: formData.phoneNumber,
            recipientContext: formData.recipientContext,
            paymentMethod: "web3_wallet",
            isFree: false,
          },
        });

        toast.success("Payment processed! Call request submitted for processing.");
        
        // Reset form
        setFormData({
          recipientName: "",
          phoneNumber: "",
          recipientContext: "",
        });
      } catch (error) {
        console.error("Error creating call:", error);
        toast.error("Failed to create call request. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="recipientName">Recipient Name</Label>
        <Input
          id="recipientName"
          value={formData.recipientName}
          onChange={(e) =>
            setFormData({ ...formData, recipientName: e.target.value })
          }
          placeholder="John Doe"
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Phone Number</Label>
        <Input
          id="phoneNumber"
          type="tel"
          value={formData.phoneNumber}
          onChange={(e) =>
            setFormData({ ...formData, phoneNumber: e.target.value })
          }
          placeholder="+1234567890"
          required
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">
          This will be encrypted before storage
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="recipientContext">Context / Message</Label>
        <Textarea
          id="recipientContext"
          value={formData.recipientContext}
          onChange={(e) =>
            setFormData({ ...formData, recipientContext: e.target.value })
          }
          placeholder="Provide context for the call..."
          rows={6}
          maxLength={1000}
          required
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">
          {formData.recipientContext.length}/1000 characters
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="agreement"
          required
          disabled={isSubmitting}
        />
        <Label htmlFor="agreement" className="text-sm">
          I agree to the{" "}
          <Link to="/terms" className="underline hover:text-primary">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline hover:text-primary">
            Privacy Policy
          </Link>
        </Label>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Processing..." : "Pay Now & Submit Call"}
      </Button>
    </form>
    <AuthModal
      open={showAuthModal}
      onOpenChange={setShowAuthModal}
      onAuthSuccess={handleAuthSuccess}
    />
    </>
  );
}
