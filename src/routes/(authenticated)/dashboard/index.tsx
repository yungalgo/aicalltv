import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SignOutButton } from "~/components/sign-out-button";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "sonner";
import { createCall } from "~/lib/calls/functions";
import { VIDEO_STYLES } from "~/lib/constants/video-styles";
import { PaymentModal } from "~/components/payment-modal";
import { PAYMENT_CONFIG } from "~/lib/thirdweb/config";

export const Route = createFileRoute("/(authenticated)/dashboard/")({
  component: DashboardIndex,
});

function DashboardIndex() {
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Check if form is valid for purchase
  const isFormValid = 
    formData.recipientName.trim() !== "" && 
    formData.phoneNumber.trim() !== "" &&
    formData.videoStyle !== "" &&
    (formData.targetGender !== "other" || formData.targetGenderCustom.trim() !== "");

  // Form validation with toast messages
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
    if (formData.targetGender === "other" && !formData.targetGenderCustom.trim()) {
      toast.error("Please specify custom gender");
      return false;
    }
    if (!formData.videoStyle) {
      toast.error("Video style is required");
      return false;
    }
    return true;
  };

  // Handle buy button click
  const handleBuyClick = () => {
    if (!validateForm()) return;
    setShowPaymentModal(true);
  };

  // Handle payment completion - creates the call
  const handlePaymentComplete = async (transactionHash: string) => {
    setIsSubmitting(true);
    setShowPaymentModal(false);

    try {
      // Create call record after successful payment
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (createCall as any)({
        data: {
          recipientName: formData.recipientName,
          phoneNumber: formData.phoneNumber,
          anythingElse: formData.anythingElse || undefined,
          targetGender: formData.targetGender,
          targetGenderCustom: formData.targetGender === "other" ? formData.targetGenderCustom : undefined,
          targetAgeRange: formData.targetAgeRange || undefined,
          targetPhysicalDescription: formData.targetPhysicalDescription || undefined,
          interestingPiece: formData.interestingPiece || undefined,
          videoStyle: formData.videoStyle,
          paymentMethod: "web3_wallet",
          isFree: false,
          paymentTxHash: transactionHash,
          paymentAmount: PAYMENT_CONFIG.priceUSDC,
        },
      });

      toast.success("🎉 Purchase complete! Your AI call is being processed.");
      
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
      console.error("Error creating call:", error);
      toast.error("Payment succeeded but failed to create call. Please contact support.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      {/* Payment Modal */}
      <PaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        onPaymentComplete={handlePaymentComplete}
        callDetails={{ recipientName: formData.recipientName }}
      />

    <div className="container mx-auto max-w-2xl p-6">
        {/* Header - Cameo style */}
        <div className="rounded-2xl bg-card border p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">AI Call TV</h1>
              <p className="text-muted-foreground mt-1">
                Personalized AI video call + generated video
        </p>
      </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">
                ${PAYMENT_CONFIG.priceUSD}
              </div>
              <p className="text-sm text-muted-foreground">per video</p>
            </div>
          </div>
          
          <div className="flex gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-yellow-500">⚡</span>
              <span>~24hr delivery</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>HD Video</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-500">📞</span>
              <span>Real AI Call</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-2xl bg-card border p-6 space-y-6">
          <h2 className="text-lg font-semibold">Customize Your Call</h2>
          
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
              className="text-lg"
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
              className="text-lg"
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
                    targetGender: e.target.value as typeof formData.targetGender,
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
                    targetAgeRange: e.target.value as typeof formData.targetAgeRange,
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
                setFormData({ ...formData, targetGenderCustom: e.target.value })
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
                {style.charAt(0).toUpperCase() + style.slice(1).replace(/-/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
            <Label htmlFor="interestingPiece">
              Personal hook <span className="text-muted-foreground">(makes it more authentic)</span>
            </Label>
            <Textarea
              id="interestingPiece"
              value={formData.interestingPiece}
              onChange={(e) =>
                setFormData({ ...formData, interestingPiece: e.target.value })
              }
              placeholder="Things only they would know... e.g. 'they love their dog Biscuit' or 'their favorite movie is The Matrix'"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="anythingElse">
              Additional notes <span className="text-muted-foreground">(optional)</span>
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
        </div>

        {/* Purchase Button - Cameo style */}
        <div className="mt-6 rounded-2xl bg-card border p-6">
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <input type="checkbox" id="terms" required className="rounded" />
            <label htmlFor="terms">
              I agree to the <a href="/terms" className="underline">Terms</a> and{" "}
              <a href="/privacy" className="underline">Privacy Policy</a>
            </label>
          </div>

          <Button
            type="button"
            size="lg"
            onClick={handleBuyClick}
            disabled={isSubmitting || !isFormValid}
            className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 rounded-full"
          >
            {isSubmitting ? (
              "Processing..."
            ) : (
              <>
                <span className="mr-2">🛡️</span>
                Buy a Call ${PAYMENT_CONFIG.priceUSD}
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-3">
            Secure payment via credit card or crypto
          </p>
        </div>

        <div className="mt-8 pt-8 border-t text-center">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
