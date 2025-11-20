import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SignOutButton } from "~/components/sign-out-button";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "sonner";
import { createCall } from "~/lib/calls/functions";

export const Route = createFileRoute("/(authenticated)/dashboard/")({
  component: DashboardIndex,
});

function DashboardIndex() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    recipientName: "",
    phoneNumber: "",
    recipientContext: "",
    paymentMethod: "free" as "free" | "web3_wallet",
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

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
      // Dummy payment flow: Simulates payment processing, then submits call for processing
      // In production: Payment processed → Webhook → Create call record
      // For now: Directly create call record (simulating successful payment)
      // Call server function - data is passed directly as the argument
      const result = await (createCall as any)({
        recipientName: formData.recipientName,
        phoneNumber: formData.phoneNumber,
        recipientContext: formData.recipientContext,
        paymentMethod: formData.paymentMethod,
        isFree: formData.paymentMethod === "free",
      });

      toast.success(
        formData.paymentMethod === "free"
          ? "Call request submitted! (Free call)"
          : "Payment processed! Call request submitted for processing.",
      );
      
      // Reset form
      setFormData({
        recipientName: "",
        phoneNumber: "",
        recipientContext: "",
        paymentMethod: "free",
      });

      // Navigate to calls/videos tab (we'll create this next)
      // navigate({ to: "/dashboard/calls" });
    } catch (error) {
      console.error("Error creating call:", error);
      toast.error("Failed to create call request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl p-6">
        <div className="mb-6">
        <h1 className="text-3xl font-bold">Request a Call</h1>
        <p className="text-muted-foreground mt-2">
          Fill out the form below to request an AI call. Pay-per-call pricing ($5 per call).
        </p>
      </div>

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

        <div className="space-y-2">
          <Label>Payment Method</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="paymentMethod"
                value="free"
                checked={formData.paymentMethod === "free"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    paymentMethod: e.target.value as "free" | "web3_wallet",
                  })
                }
                disabled={isSubmitting}
              />
              <span>Free (if credits available)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="paymentMethod"
                value="web3_wallet"
                checked={formData.paymentMethod === "web3_wallet"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    paymentMethod: e.target.value as "free" | "web3_wallet",
                  })
                }
                disabled={isSubmitting}
              />
              <span>Pay Now (Dummy)</span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="tos"
            required
            disabled={isSubmitting}
          />
          <Label htmlFor="tos" className="text-sm">
            I agree to the Terms of Service
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="privacy"
            required
            disabled={isSubmitting}
          />
          <Label htmlFor="privacy" className="text-sm">
            I agree to the Privacy Policy
          </Label>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Processing..."
            : formData.paymentMethod === "free"
              ? "Submit Call Request (Free)"
              : "Process Payment & Submit Call"}
        </Button>
      </form>

      <div className="mt-8 pt-8 border-t">
        <SignOutButton />
      </div>
    </div>
  );
}
