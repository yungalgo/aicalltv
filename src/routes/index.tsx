import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Suspense, useState, useEffect } from "react";
import { AuthModal } from "~/components/auth-modal";
import { CallsTable } from "~/components/calls-table";
import { Header } from "~/components/header";
import { PaymentModal } from "~/components/payment-modal";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "sonner";
import { authQueryOptions } from "~/lib/auth/queries";
import { createCall } from "~/lib/calls/functions";
import { VIDEO_STYLES } from "~/lib/constants/video-styles";
import { PAYMENT_CONFIG } from "~/lib/web3/config";
import { z } from "zod";

const searchSchema = z.object({
  payment: z.enum(["success", "cancelled"]).optional(),
});

export const Route = createFileRoute("/")({
  component: HomePage,
  validateSearch: searchSchema,
});

function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <div className="container mx-auto max-w-4xl p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Buy an AI Call</h1>
          <p className="text-muted-foreground mt-2">
            Personalized AI video call + generated video.{" "}
            <span className="font-semibold text-primary">
              ${PAYMENT_CONFIG.priceUSD} per call
            </span>
          </p>
        </div>

        <Suspense fallback={<div className="py-6">Loading...</div>}>
          <PageContent />
        </Suspense>
      </div>
    </div>
  );
}

function PageContent() {
  const { data: user } = useSuspenseQuery(authQueryOptions());

  if (user) {
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <CallRequestForm />
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4">Your Calls</h2>
          <Suspense fallback={<div className="py-6">Loading calls...</div>}>
            <CallsTable />
          </Suspense>
        </div>
      </div>
    );
  }

  return <CallRequestForm />;
}

function CallRequestForm() {
  const { data: user } = useSuspenseQuery(authQueryOptions());
  const queryClient = useQueryClient();
  const search = useSearch({ from: "/" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [formData, setFormData] = useState({
    recipientName: "",
    phoneNumber: "",
    anythingElse: "",
    targetGender: "male" as "male" | "female" | "prefer_not_to_say" | "other",
    targetGenderCustom: "",
    targetAgeRange: "" as "" | "18-25" | "26-35" | "36-45" | "46-55" | "56+",
    targetPhysicalDescription: "",
    interestingPiece: "",
    videoStyle: "anime",
  });

  // Handle Stripe payment return - show toast and refresh calls
  useEffect(() => {
    if (search.payment === "success") {
      toast.success("🎉 Payment successful! Your AI call is being processed.", {
        duration: 5000,
      });
      // Refresh calls table
      queryClient.invalidateQueries({ queryKey: ["calls"] });
      // Clean up URL (remove ?payment=success)
      window.history.replaceState({}, "", "/");
    } else if (search.payment === "cancelled") {
      toast.info("Payment was cancelled.", { duration: 3000 });
      window.history.replaceState({}, "", "/");
    }
  }, [search.payment, queryClient]);

  // Form validation
  const validateForm = (): boolean => {
    if (!formData.recipientName.trim()) {
      toast.error("Recipient name is required");
      return false;
    }
    if (!formData.phoneNumber.trim()) {
      toast.error("Phone number is required");
      return false;
    }
    if (formData.anythingElse && formData.anythingElse.length > 1000) {
      toast.error("'Anything Else' must be 1000 characters or less");
      return false;
    }
    if (
      formData.targetGender === "other" &&
      !formData.targetGenderCustom.trim()
    ) {
      toast.error("Please specify custom gender");
      return false;
    }
    if (!formData.videoStyle) {
      toast.error("Video style is required");
      return false;
    }
    return true;
  };

  // Handle form submission - checks auth then shows payment
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate form first
    if (!validateForm()) return;

    // If not logged in, show auth modal first
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // User is logged in - show payment modal
    setShowPaymentModal(true);
  };

  // After successful auth, show payment modal
  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    // Small delay to let auth state update
    setTimeout(() => {
      setShowPaymentModal(true);
    }, 100);
  };

  // After successful payment, create the call
  const handlePaymentComplete = async (transactionHash: string) => {
    setIsSubmitting(true);
    setShowPaymentModal(false);

    try {
      console.log("[Client] Payment complete, creating call...");
      // Credit was created in payment modal, backend will consume it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (createCall as any)({
        data: {
          recipientName: formData.recipientName,
          phoneNumber: formData.phoneNumber,
          anythingElse: formData.anythingElse || undefined,
          targetGender: formData.targetGender,
          targetGenderCustom:
            formData.targetGender === "other"
              ? formData.targetGenderCustom
              : undefined,
          targetAgeRange: formData.targetAgeRange || undefined,
          targetPhysicalDescription:
            formData.targetPhysicalDescription || undefined,
          interestingPiece: formData.interestingPiece || undefined,
          videoStyle: formData.videoStyle,
        },
      });
      console.log("[Client] Call created:", result);

      toast.success(
        "🎉 Purchase complete! Your AI call is being processed.",
        {
          duration: 5000,
        }
      );

      // Invalidate calls query to refresh the table
      queryClient.invalidateQueries({ queryKey: ["calls"] });

      // Reset form
      setFormData({
        recipientName: "",
        phoneNumber: "",
        anythingElse: "",
        targetGender: "male",
        targetGenderCustom: "",
        targetAgeRange: "",
        targetPhysicalDescription: "",
        interestingPiece: "",
        videoStyle: "anime",
      });
    } catch (error) {
      console.error("[Client] Error creating call:", error);
      toast.error(
        "Payment succeeded but failed to create call. Please contact support with your transaction hash: " +
          transactionHash
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="recipientName">Who should we call? *</Label>
          <Input
            id="recipientName"
            value={formData.recipientName}
            onChange={(e) =>
              setFormData({ ...formData, recipientName: e.target.value })
            }
            placeholder="Their name"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phoneNumber">Their phone number *</Label>
          <Input
            id="phoneNumber"
            type="tel"
            value={formData.phoneNumber}
            onChange={(e) =>
              setFormData({ ...formData, phoneNumber: e.target.value })
            }
            placeholder="+1 (555) 123-4567"
            required
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            🔒 Encrypted before storage
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="targetGender">Gender</Label>
            <select
              id="targetGender"
              value={formData.targetGender}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  targetGender: e.target
                    .value as typeof formData.targetGender,
                  targetGenderCustom: "",
                })
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={isSubmitting}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetAgeRange">Age Range</Label>
            <select
              id="targetAgeRange"
              value={formData.targetAgeRange}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  targetAgeRange: e.target
                    .value as typeof formData.targetAgeRange,
                })
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={isSubmitting}
            >
              <option value="">Any</option>
              <option value="18-25">18-25</option>
              <option value="26-35">26-35</option>
              <option value="36-45">36-45</option>
              <option value="46-55">46-55</option>
              <option value="56+">56+</option>
            </select>
          </div>
        </div>

        {formData.targetGender === "other" && (
          <div className="space-y-2">
            <Label htmlFor="targetGenderCustom">Specify gender *</Label>
            <Input
              id="targetGenderCustom"
              value={formData.targetGenderCustom}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  targetGenderCustom: e.target.value,
                })
              }
              placeholder="Please specify"
              required
              disabled={isSubmitting}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="videoStyle">Video Style *</Label>
          <select
            id="videoStyle"
            value={formData.videoStyle}
            onChange={(e) =>
              setFormData({ ...formData, videoStyle: e.target.value })
            }
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
            disabled={isSubmitting}
          >
            {VIDEO_STYLES.map((style) => (
              <option key={style} value={style}>
                {style.charAt(0).toUpperCase() +
                  style.slice(1).replace(/-/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="interestingPiece">
            Personal hook{" "}
            <span className="text-muted-foreground">
              (makes it more authentic)
            </span>
          </Label>
          <Textarea
            id="interestingPiece"
            value={formData.interestingPiece}
            onChange={(e) =>
              setFormData({ ...formData, interestingPiece: e.target.value })
            }
            placeholder="Things only they would know... e.g. 'they love their dog Biscuit'"
            rows={3}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="anythingElse">
            Additional notes{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="anythingElse"
            value={formData.anythingElse}
            onChange={(e) =>
              setFormData({ ...formData, anythingElse: e.target.value })
            }
            placeholder="Any other context or special requests..."
            rows={2}
            maxLength={1000}
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground text-right">
            {formData.anythingElse.length}/1000
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="agreement"
            required
            disabled={isSubmitting}
            className="rounded"
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
          className="w-full h-14 text-lg font-semibold rounded-full"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Processing..."
            : `🛡️ Buy a Call $${PAYMENT_CONFIG.priceUSD}`}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Secure payment via credit card or crypto
        </p>
      </form>

      {/* Auth Modal - shown when not logged in */}
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Payment Modal - shown after auth (or immediately if logged in) */}
      <PaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        onPaymentComplete={handlePaymentComplete}
        callDetails={{
          recipientName: formData.recipientName,
          phoneNumber: formData.phoneNumber,
          targetGender: formData.targetGender,
          targetGenderCustom: formData.targetGenderCustom,
          targetAgeRange: formData.targetAgeRange,
          interestingPiece: formData.interestingPiece,
          videoStyle: formData.videoStyle,
          anythingElse: formData.anythingElse,
        }}
      />
    </>
  );
}
