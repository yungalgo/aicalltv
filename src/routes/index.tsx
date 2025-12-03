import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Suspense, useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { AuthModal } from "~/components/auth-modal";
import { CallsTable } from "~/components/calls-table";
import { FhenixPrivacyToggle, type PrivacyMode, useFhenixReady, useFhenixEncryption } from "~/components/fhenix-privacy-toggle";
import { Header } from "~/components/header";
import { NearAiChat } from "~/components/near-ai-chat";
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
import { validateCallFormData } from "~/lib/validation/call-form";
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

type InputMode = "form" | "ai-chat";

// Flashy Tab Component
function InputModeTab({
  mode,
  currentMode,
  onClick,
  icon,
  label,
  sublabel,
  badge,
  isAi,
}: {
  mode: InputMode;
  currentMode: InputMode;
  onClick: () => void;
  icon: string;
  label: string;
  sublabel: string;
  badge?: string;
  isAi?: boolean;
}) {
  const isActive = mode === currentMode;
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative flex-1 flex flex-col items-center justify-center py-4 px-3 sm:px-6 rounded-xl
        transition-all duration-300 overflow-hidden group min-h-[120px]
        ${isActive 
          ? isAi 
            ? "bg-gradient-to-br from-violet-600 via-purple-600 to-cyan-500 text-white shadow-lg near-ai-glow" 
            : "bg-primary text-primary-foreground shadow-md"
          : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
        }
      `}
    >
      {/* Shimmer effect for AI tab when active */}
      {isAi && isActive && (
        <div className="absolute inset-0 near-ai-shimmer pointer-events-none" />
      )}
      
      {/* Badge - positioned top right */}
      {badge && (
        <span className={`
          absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full z-10
          ${isActive 
            ? "bg-white/20 text-white" 
            : "bg-gradient-to-r from-violet-500 to-cyan-500 text-white"
          }
        `}>
          {badge}
        </span>
      )}
      
      {/* Icon with float animation for AI */}
      <span className={`text-2xl mb-1 ${isAi && isActive ? "near-ai-float" : ""}`}>
        {icon}
      </span>
      
      {/* Label */}
      <span className="font-semibold text-sm text-center">{label}</span>
      
      {/* Sublabel */}
      <span className={`text-xs mt-0.5 text-center ${isActive ? "opacity-80" : "opacity-60"}`}>
        {sublabel}
      </span>
      
      {/* TEE Badge for AI tab - in flow, not absolute */}
      {isAi && (
        <span className={`
          mt-2 text-[9px] font-medium px-2 py-0.5 rounded-full
          flex items-center gap-1 whitespace-nowrap
          ${isActive 
            ? "bg-green-400/20 text-green-100 tee-badge" 
            : "bg-green-500/10 text-green-600 dark:text-green-400"
          }
        `}>
          🔒 TEE Secured
        </span>
      )}
    </button>
  );
}

function CallRequestForm() {
  const { data: user } = useSuspenseQuery(authQueryOptions());
  const queryClient = useQueryClient();
  const search = useSearch({ from: "/" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("form");
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("standard");
  const { isConnected: isWalletConnected } = useAccount();
  const isFhenixReady = useFhenixReady(privacyMode);
  
  // Fhenix encryption hook
  const { 
    encryptPhone, 
    isEncrypting, 
    encryptionError 
  } = useFhenixEncryption();
  
  // Store the vault callId after encryption (used instead of raw phone)
  const [fhenixVaultId, setFhenixVaultId] = useState<string | null>(null);
  
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

  // Handle data from NEAR AI chat
  const handleAiFormFill = useCallback((data: Partial<typeof formData>) => {
    setFormData((prev) => ({
      ...prev,
      recipientName: data.recipientName || prev.recipientName,
      phoneNumber: data.phoneNumber || prev.phoneNumber,
      targetGender: data.targetGender || prev.targetGender,
      targetGenderCustom: data.targetGenderCustom || prev.targetGenderCustom,
      targetAgeRange: data.targetAgeRange || prev.targetAgeRange,
      interestingPiece: data.interestingPiece || prev.interestingPiece,
      videoStyle: data.videoStyle || prev.videoStyle,
      anythingElse: data.anythingElse || prev.anythingElse,
    }));
  }, []);

  // Handle completion from NEAR AI chat - switch to form view and trigger payment
  const handleAiComplete = useCallback((data: Partial<typeof formData>) => {
    handleAiFormFill(data);
    // Switch to form view so user can review
    setInputMode("form");
    toast.success("Form filled from AI! Review and click 'Buy a Call' to proceed.");
  }, [handleAiFormFill]);

  // Handle Stripe payment return - show toast and refresh calls
  useEffect(() => {
    if (search.payment === "success") {
      toast.success("🎉 Payment successful! Your AI call is being processed.", {
        duration: 5000,
      });
      // Force immediate refetch of calls table
      queryClient.refetchQueries({ queryKey: ["calls"] });
      // Clean up URL (remove ?payment=success)
      window.history.replaceState({}, "", "/");
    } else if (search.payment === "cancelled") {
      toast.info("Payment was cancelled.", { duration: 3000 });
      window.history.replaceState({}, "", "/");
    }
  }, [search.payment, queryClient]);

  // Form validation using the same validation logic as API
  const validateForm = (): boolean => {
    const validationResult = validateCallFormData(formData);
    
    if (!validationResult.isValid) {
      // Show first error to user
      const firstError = validationResult.errors[0];
      toast.error(`${firstError.field}: ${firstError.message}`);
      return false;
    }
    
    // Update form data with normalized values (especially phone number)
    if (validationResult.normalizedData.phoneNumber) {
      setFormData((prev) => ({
        ...prev,
        phoneNumber: validationResult.normalizedData.phoneNumber!,
      }));
    }
    
    return true;
  };

  // Handle form submission - checks auth then shows payment
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting || isEncrypting) return;

    // Validate form first
    if (!validateForm()) return;

    // If Fhenix mode selected but wallet not connected, show error
    if (privacyMode === "fhenix" && !isFhenixReady) {
      toast.error("Please connect your Base wallet to use Fhenix encryption");
      return;
    }

    // If not logged in, show auth modal first
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // If Fhenix mode, encrypt phone number on-chain first
    if (privacyMode === "fhenix") {
      toast.info("🔐 Encrypting phone number on Base...", { duration: 3000 });
      
      const result = await encryptPhone(formData.phoneNumber);
      
      if (!result) {
        toast.error(encryptionError || "Failed to encrypt phone number. Please try again.");
        return;
      }
      
      // Store the vault ID for use in call creation
      setFhenixVaultId(result.callId);
      toast.success("✅ Phone encrypted on-chain!", { duration: 2000 });
    }

    // User is logged in (and phone encrypted if Fhenix) - show payment modal
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
          // If Fhenix mode, send vault ID; otherwise send phone number
          phoneNumber: privacyMode === "fhenix" && fhenixVaultId 
            ? `fhenix:${fhenixVaultId}` // Prefix to indicate it's a vault reference
            : formData.phoneNumber,
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
          // Include fhenix metadata
          fhenixEnabled: privacyMode === "fhenix",
          fhenixVaultId: fhenixVaultId || undefined,
        },
      });
      console.log("[Client] Call created:", result);

      toast.success(
        "🎉 Purchase complete! Your AI call is being processed.",
        {
          duration: 5000,
        }
      );

      // Force immediate refetch of calls table
      await queryClient.refetchQueries({ queryKey: ["calls"] });

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
      // Reset Fhenix state
      setFhenixVaultId(null);
      setPrivacyMode("standard");
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
      {/* Flashy Input Mode Tabs */}
      <div className="mb-8">
        {/* Tab Header */}
        <div className="text-center mb-4">
          <p className="text-sm text-muted-foreground">
            Choose how you want to create your call
          </p>
        </div>
        
        {/* Tabs Container */}
        <div className="flex gap-3 p-1.5 bg-muted/30 rounded-2xl border">
          <InputModeTab
            mode="form"
            currentMode={inputMode}
            onClick={() => setInputMode("form")}
            icon="📝"
            label="Manual Form"
            sublabel="Fill in details yourself"
          />
          <InputModeTab
            mode="ai-chat"
            currentMode={inputMode}
            onClick={() => setInputMode("ai-chat")}
            icon="✨"
            label="AI Assistant"
            sublabel="Describe in natural language"
            badge="NEW"
            isAi
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
      {/* AI Chat Mode */}
      {inputMode === "ai-chat" && (
        <div className="relative mb-8">
          {/* Animated border wrapper */}
          <div className="absolute -inset-[2px] rounded-2xl near-ai-border opacity-70" />
          
          {/* Content */}
          <div className="relative rounded-xl bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 p-6 border border-violet-500/20">
            {/* Header Banner */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-violet-500/20">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full blur-md opacity-50" />
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500">
                    <span className="text-lg">🤖</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <span className="near-ai-gradient-text">NEAR AI</span>
                    <span className="text-white/60">Assistant</span>
                  </h3>
                  <p className="text-xs text-violet-300/70">
                    Private inference powered by Trusted Execution Environment
                  </p>
                </div>
              </div>
              
              {/* TEE Verified Badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 tee-badge">
                <span className="text-green-400 text-xs">🔐</span>
                <span className="text-green-400 text-xs font-medium">TEE Verified</span>
              </div>
            </div>
            
            {/* Chat Component */}
            <NearAiChat
              onFormFill={handleAiFormFill}
              onComplete={handleAiComplete}
            />
            
            {/* Footer Info */}
            <div className="mt-4 pt-4 border-t border-violet-500/20">
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-violet-300/60">
                <span className="flex items-center gap-1">
                  <span>🔒</span> End-to-end private
                </span>
                <span className="flex items-center gap-1">
                  <span>⚡</span> DeepSeek V3.1
                </span>
                <span className="flex items-center gap-1">
                  <span>✓</span> Verifiable inference
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Fields - Only shown when form mode is active */}
      {inputMode === "form" && (
      <>
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
          <Label htmlFor="phoneNumber">Their phone number (US) *</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-medium">+1</span>
            <Input
              id="phoneNumber"
              type="tel"
              value={formData.phoneNumber?.replace(/^\+1\s?/, "") || ""}
              onChange={(e) => {
                // Auto-add +1 prefix, remove non-digits
                let value = e.target.value.replace(/[^\d]/g, "");
                // Limit to 10 digits (US phone number)
                if (value.length > 10) {
                  value = value.substring(0, 10);
                }
                // Always add +1 prefix
                setFormData({ ...formData, phoneNumber: value ? `+1${value}` : "" });
              }}
              placeholder="(555) 123-4567"
              required
              disabled={isSubmitting}
              className="flex-1"
              maxLength={14} // (555) 123-4567 = 14 chars
            />
          </div>
          <p className="text-xs text-muted-foreground">
            🔒 Encrypted before storage • US numbers only (10 digits)
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
      </>
      )}

        {/* Fhenix Privacy Toggle - Always visible */}
        <FhenixPrivacyToggle
          value={privacyMode}
          onChange={setPrivacyMode}
          disabled={isSubmitting}
        />

        {/* Terms checkbox - Always visible */}
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

        {/* Submit button - Always visible */}
        <Button
          type="submit"
          size="lg"
          className={`w-full h-14 text-lg font-semibold rounded-full ${
            privacyMode === "fhenix" 
              ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700" 
              : ""
          }`}
          disabled={isSubmitting || isEncrypting}
        >
          {isEncrypting
            ? "🔐 Encrypting on Base..."
            : isSubmitting
            ? "Processing..."
            : privacyMode === "fhenix"
            ? `🔐 Buy with FHE Privacy $${PAYMENT_CONFIG.priceUSD}`
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
