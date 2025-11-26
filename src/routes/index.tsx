import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { AuthModal } from "~/components/auth-modal";
import { CallsTable } from "~/components/calls-table";
import { Header } from "~/components/header";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "sonner";
import { authQueryOptions } from "~/lib/auth/queries";
import { createCall } from "~/lib/calls/functions";
import { VIDEO_STYLES } from "~/lib/constants/video-styles";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <div className="container mx-auto max-w-4xl p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Request a Call</h1>
          <p className="text-muted-foreground mt-2">
            Fill out the form below to request an AI call. Pay-per-call pricing ($5 per call).
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
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
    if (formData.anythingElse && formData.anythingElse.length > 1000) {
      toast.error("'Anything Else' must be 1000 characters or less");
      return;
    }
    if (formData.targetGender === "other" && !formData.targetGenderCustom.trim()) {
      toast.error("Please specify custom gender");
      return;
    }
    if (!formData.videoStyle) {
      toast.error("Video style is required");
      return;
    }

    setIsSubmitting(true);

    try {
      // Dummy payment flow: Automatically uses web3_wallet payment method
      // Call server function - data must be wrapped in { data: ... }
      console.log("[Client] Calling createCall with data:", formData);
      const result = await (createCall as any)({
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
          paymentMethod: "free", // Default to free for testing
          isFree: true,
        },
      });
      console.log("[Client] createCall result:", result); 

      toast.success("Payment processed! Call request submitted for processing.");
      
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
      console.error("[Client] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });
      toast.error(`Failed to create call request: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuthSuccess = async () => {
    // After successful auth, automatically submit the form
    if (formData.recipientName && formData.phoneNumber) {
      setIsSubmitting(true);
      try {
        console.log("[Client] Calling createCall (from handleAuthSuccess) with data:", formData);
        const result = await (createCall as any)({
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
            paymentMethod: "free", // Default to free for testing
            isFree: true,
          },
        });
        console.log("[Client] createCall result (from handleAuthSuccess):", result);

        toast.success("Call request submitted! Processing will begin shortly.");
        
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
        <Label htmlFor="targetGender">Target Person Gender</Label>
        <select
          id="targetGender"
          value={formData.targetGender}
          onChange={(e) =>
            setFormData({
              ...formData,
              targetGender: e.target.value as "male" | "female" | "prefer_not_to_say" | "other",
              targetGenderCustom: "",
            })
          }
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          required
          disabled={isSubmitting}
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="prefer_not_to_say">Prefer not to say</option>
          <option value="other">Other</option>
        </select>
      </div>

      {formData.targetGender === "other" && (
        <div className="space-y-2">
          <Label htmlFor="targetGenderCustom">Custom Gender</Label>
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
        <Label htmlFor="targetAgeRange">Target Person Age Range (Optional)</Label>
        <select
          id="targetAgeRange"
          value={formData.targetAgeRange}
          onChange={(e) =>
            setFormData({
              ...formData,
              targetAgeRange: e.target.value as typeof formData.targetAgeRange,
            })
          }
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
        >
          <option value="">Prefer not to say</option>
          <option value="18-25">18-25</option>
          <option value="26-35">26-35</option>
          <option value="36-45">36-45</option>
          <option value="46-55">46-55</option>
          <option value="56+">56+</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetPhysicalDescription">Physical Description (Optional)</Label>
        <Textarea
          id="targetPhysicalDescription"
          value={formData.targetPhysicalDescription}
          onChange={(e) =>
            setFormData({ ...formData, targetPhysicalDescription: e.target.value })
          }
          placeholder="Hair color, style, clothing, etc."
          rows={3}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="interestingPiece">Interesting Piece / Personal Hook</Label>
        <Textarea
          id="interestingPiece"
          value={formData.interestingPiece}
          onChange={(e) =>
            setFormData({ ...formData, interestingPiece: e.target.value })
          }
          placeholder="Small personal details that would hook them - things regular people wouldn't know..."
          rows={3}
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">
          Personal details that will make the call more engaging and authentic
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="videoStyle">Video Aesthetic Style</Label>
        <select
          id="videoStyle"
          value={formData.videoStyle}
          onChange={(e) =>
            setFormData({ ...formData, videoStyle: e.target.value })
          }
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
        <Label htmlFor="anythingElse">Anything Else? (Optional)</Label>
        <Textarea
          id="anythingElse"
          value={formData.anythingElse}
          onChange={(e) =>
            setFormData({ ...formData, anythingElse: e.target.value })
          }
          placeholder="Any additional context or notes..."
          rows={4}
          maxLength={1000}
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">
          {formData.anythingElse.length}/1000 characters
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
        {isSubmitting ? "Processing..." : "Submit Call Request"}
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
