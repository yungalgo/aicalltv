import { useQueryClient, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, X } from "lucide-react";
import { AuthModal } from "~/components/auth-modal";
import { type PrivacyMode, useFhenixReady, useFhenixEncryption, FhenixPrivacyToggle } from "~/components/fhenix-privacy-toggle";
import { NearAiAssistant } from "~/components/near-ai-assistant";
import { PaymentModal } from "~/components/payment-modal";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "sonner";
import { authQueryOptions } from "~/lib/auth/queries";
import { createCall } from "~/lib/calls/functions";
import { VIDEO_STYLES } from "~/lib/constants/video-styles";
import { PAYMENT_CONFIG } from "~/lib/web3/config";
import { validateCallFormData } from "~/lib/validation/call-form";

type InputMode = "form" | "ai-chat";

export function CallRequestForm() {
  const { data: user } = useSuspenseQuery(authQueryOptions());
  const queryClient = useQueryClient();
  const search = useSearch({ from: "/create" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("form");
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("standard");
  const isFhenixReady = useFhenixReady(privacyMode);
  
  // Fetch callers
  const { data: callers = [], isLoading: callersLoading, error: callersError } = useQuery<Array<{ id: string; name: string; slug: string }>>({
    queryKey: ["callers"],
    queryFn: async () => {
      const res = await fetch("/api/callers");
      if (!res.ok) throw new Error("Failed to fetch callers");
      return res.json();
    },
  });
  
  // Fhenix encryption hook
  const { 
    encryptPhone, 
    isEncrypting, 
    encryptionError 
  } = useFhenixEncryption();
  
  // Store the vault callId after encryption (used instead of raw phone)
  const [fhenixVaultId, setFhenixVaultId] = useState<string | null>(null);
  
  // Get caller from URL params
  const callerSlugFromUrl = (search as { caller?: string }).caller;
  
  const [formData, setFormData] = useState({
    recipientName: "",
    phoneNumber: "",
    callerId: null as string | null,
    targetGender: "male" as "male" | "female" | "prefer_not_to_say" | "other",
    targetGenderCustom: "",
    targetAgeRange: "" as "" | "18-25" | "26-35" | "36-45" | "46-55" | "56+",
    targetPhysicalDescription: "",
    // New personalization fields
    targetCity: "",
    targetHobby: "",
    targetProfession: "",
    interestingPiece: "", // "One thing virtually no one knows about them"
    ragebaitTrigger: "", // "If you wanted to ragebait them, you would say this"
    videoStyle: "anime",
    // Optional image upload
    uploadedImageUrl: "",
    uploadedImageS3Key: "",
  });
  
  // Use ref to track if we've processed sessionStorage (persists across renders within same mount)
  const hasProcessedStorage = useRef(false);
  // Store the loaded caller ID in a ref so it survives state resets
  const loadedCallerIdRef = useRef<string | null>(null);
  
  // Apply sessionStorage data once callers are loaded
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (callers.length === 0) return; // Wait for callers to load
    
    // If we already have a caller set in state, we're done
    if (formData.callerId) {
      // Clear sessionStorage since we have the data
      sessionStorage.removeItem("selectedCallerSlug");
      sessionStorage.removeItem("quickPrankForm");
      return;
    }
    
    // If we previously loaded a caller ID from storage, re-apply it
    if (loadedCallerIdRef.current && !formData.callerId) {
      setFormData((prev) => ({ ...prev, callerId: loadedCallerIdRef.current }));
      return;
    }
    
    // Check URL first
    if (callerSlugFromUrl) {
      const selectedCaller = callers.find((c: { slug: string }) => c.slug === callerSlugFromUrl);
      if (selectedCaller) {
        loadedCallerIdRef.current = selectedCaller.id;
        setFormData((prev) => ({ ...prev, callerId: selectedCaller.id }));
        return;
      }
    }
    
    // Only read sessionStorage once per page load
    if (hasProcessedStorage.current) return;
    
    // Read directly from sessionStorage
    const savedCallerSlug = sessionStorage.getItem("selectedCallerSlug");
    const quickFormDataStr = sessionStorage.getItem("quickPrankForm");
    
    if (!savedCallerSlug && !quickFormDataStr) {
      hasProcessedStorage.current = true;
      return;
    }
    
    const updates: Partial<typeof formData> = {};
    
    // Check sessionStorage for caller slug (from caller page)
    if (savedCallerSlug) {
      const selectedCaller = callers.find((c) => c.slug === savedCallerSlug);
      if (selectedCaller) {
        updates.callerId = selectedCaller.id;
        loadedCallerIdRef.current = selectedCaller.id;
      }
    }
    
    // Check quickPrankForm for all form data (from home page)
    if (quickFormDataStr) {
      try {
        const parsed = JSON.parse(quickFormDataStr);
        
        if (parsed.recipientName) updates.recipientName = parsed.recipientName;
        if (parsed.recipientPhone) updates.phoneNumber = parsed.recipientPhone;
        if (parsed.videoStyle) updates.videoStyle = parsed.videoStyle;
        
        if (parsed.callerSlug && !updates.callerId) {
          const selectedCaller = callers.find((c: { slug: string }) => c.slug === parsed.callerSlug);
          if (selectedCaller) {
            updates.callerId = selectedCaller.id;
            loadedCallerIdRef.current = selectedCaller.id;
          }
        }
      } catch (e) {
        console.error("Failed to parse quickPrankForm:", e);
      }
    }
    
    hasProcessedStorage.current = true;
    
    // Apply updates
    if (Object.keys(updates).length > 0) {
      setFormData((prev) => ({ ...prev, ...updates }));
    }
    
    // Only clear sessionStorage after we've stored the ID in ref
          sessionStorage.removeItem("selectedCallerSlug");
    sessionStorage.removeItem("quickPrankForm");
  }, [callers, formData.callerId, callerSlugFromUrl]);
  
  // Image upload state
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Must be logged in to upload images
    if (!user) {
      toast.error("Please log in to upload an image");
      setShowAuthModal(true);
      // Clear the file input so they can try again after logging in
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploadingImage(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const response = await fetch("/api/upload/image", {
        method: "POST",
        body: formDataUpload,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      setFormData((prev) => ({
        ...prev,
        uploadedImageUrl: result.url,
        uploadedImageS3Key: result.key,
      }));
      toast.success("Image uploaded! We'll use it in your video");
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error("Failed to upload image. Please try again.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Remove uploaded image
  const handleRemoveImage = () => {
    setFormData((prev) => ({
      ...prev,
      uploadedImageUrl: "",
      uploadedImageS3Key: "",
      // Physical description becomes required again when image is removed
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle data from NEAR AI chat
  const handleAiFormFill = useCallback((data: Partial<typeof formData>) => {
    console.log("[CallRequestForm] AI form fill received:", data);
    setFormData((prev) => {
      const updated = {
        ...prev,
        recipientName: data.recipientName || prev.recipientName,
        phoneNumber: data.phoneNumber || prev.phoneNumber,
        targetGender: data.targetGender || prev.targetGender,
        targetGenderCustom: data.targetGenderCustom || prev.targetGenderCustom,
        targetAgeRange: data.targetAgeRange || prev.targetAgeRange,
        targetPhysicalDescription: data.targetPhysicalDescription || prev.targetPhysicalDescription,
        targetCity: data.targetCity || prev.targetCity,
        targetHobby: data.targetHobby || prev.targetHobby,
        targetProfession: data.targetProfession || prev.targetProfession,
        interestingPiece: data.interestingPiece || prev.interestingPiece,
        ragebaitTrigger: data.ragebaitTrigger || prev.ragebaitTrigger,
        callerId: data.callerId ?? prev.callerId,
        videoStyle: data.videoStyle || prev.videoStyle,
        uploadedImageUrl: data.uploadedImageUrl || prev.uploadedImageUrl,
        uploadedImageS3Key: data.uploadedImageS3Key || prev.uploadedImageS3Key,
      };
      console.log("[CallRequestForm] Updated form data:", updated);
      return updated;
    });
  }, []);

  // Handle completion from NEAR AI chat - just fill the form, don't switch views
  const handleAiComplete = useCallback((data: Partial<typeof formData>) => {
    console.log("[CallRequestForm] AI completion received:", data);
    handleAiFormFill(data);
    // Don't switch to form view - keep AI chat open, user can use Buy button below
    toast.success("Form filled! Click 'Buy a Call' below to proceed.");
  }, [handleAiFormFill]);

  // Handle Stripe payment return - show toast and refresh calls
  useEffect(() => {
    if ((search as any).payment === "success") {
      toast.success("🎉 Payment successful! Your AI call is being processed.", {
        duration: 5000,
      });
      // Force immediate refetch of calls table
      queryClient.refetchQueries({ queryKey: ["calls"] });
      // Clean up URL (remove ?payment=success)
      window.history.replaceState({}, "", "/create");
    } else if ((search as any).payment === "cancelled") {
      toast.info("Payment was cancelled.", { duration: 3000 });
      window.history.replaceState({}, "", "/create");
    }
  }, [(search as any).payment, queryClient]);

  // Form validation using the same validation logic as API
  const validateForm = (): boolean => {
    // Check caller is selected
    if (!formData.callerId) {
      toast.error("Please select a caller");
      return false;
    }
    
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
          callerId: formData.callerId || undefined,
          targetGender: formData.targetGender,
          targetGenderCustom:
            formData.targetGender === "other"
              ? formData.targetGenderCustom
              : undefined,
          targetAgeRange: formData.targetAgeRange || undefined,
          targetPhysicalDescription:
            formData.targetPhysicalDescription || undefined,
            // New personalization fields
            targetCity: formData.targetCity || undefined,
            targetHobby: formData.targetHobby || undefined,
            targetProfession: formData.targetProfession || undefined,
          interestingPiece: formData.interestingPiece || undefined,
            ragebaitTrigger: formData.ragebaitTrigger || undefined,
          videoStyle: formData.videoStyle,
            // Optional uploaded image
            uploadedImageUrl: formData.uploadedImageUrl || undefined,
            uploadedImageS3Key: formData.uploadedImageS3Key || undefined,
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
        callerId: null,
        targetGender: "male",
        targetGenderCustom: "",
        targetAgeRange: "",
        targetPhysicalDescription: "",
        targetCity: "",
        targetHobby: "",
        targetProfession: "",
        interestingPiece: "",
        ragebaitTrigger: "",
        videoStyle: "anime",
        uploadedImageUrl: "",
        uploadedImageS3Key: "",
      });
      // Reset Fhenix state
      setFhenixVaultId(null);
      setPrivacyMode("standard");
      
      // Redirect to calls page
      window.location.href = "/calls";
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
      {/* Input Mode Toggle - Segmented Control */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex rounded-lg border-2 p-1" style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A' }}>
          <button
            type="button"
            onClick={() => setInputMode("form")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              inputMode === "form"
                ? "shadow-sm"
                : "hover:opacity-70"
            }`}
            style={inputMode === "form" ? { backgroundColor: '#1A1A1A', color: 'white' } : { color: '#1A1A1A', opacity: 0.7 }}
          >
            📝 Manual Form
          </button>
          <button
            type="button"
            onClick={() => setInputMode("ai-chat")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              inputMode === "ai-chat"
                ? "shadow-sm"
                : "hover:opacity-70"
            }`}
            style={inputMode === "ai-chat" ? { backgroundColor: '#1A1A1A', color: 'white' } : { color: '#1A1A1A', opacity: 0.7 }}
          >
            ✨ NEAR AI Assistant
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
      {/* AI Chat Mode */}
      {inputMode === "ai-chat" && (
        <NearAiAssistant
          onFormFill={handleAiFormFill}
          onComplete={handleAiComplete}
        />
      )}

      {/* Form Fields - Only shown when form mode is active */}
      {inputMode === "form" && (
      <>
      {/* Section 1: Basic Information */}
      <div className="space-y-6 pb-6 border-b">
        <div>
          <h4 className="text-lg font-semibold mb-1">Basic Information</h4>
          <p className="text-sm text-muted-foreground">Who are we calling and basic details</p>
        </div>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  value={(() => {
                    // Format as (xxx) xxx-xxxx for display
                    const digits = formData.phoneNumber?.replace(/^\+1/, "").replace(/\D/g, "") || "";
                    if (digits.length === 0) return "";
                    if (digits.length <= 3) return `(${digits}`;
                    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
                  })()}
                  onChange={(e) => {
                    // Strip to digits only, limit to 10
                    const value = e.target.value.replace(/[^\d]/g, "").substring(0, 10);
                    // Store with +1 prefix (raw format for backend)
                    setFormData({ ...formData, phoneNumber: value ? `+1${value}` : "" });
                  }}
                  placeholder="(555) 123-4567"
                  required
                  disabled={isSubmitting}
                  className="flex-1"
                  maxLength={14} // (555) 123-4567 = 14 chars
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="targetGender">Gender *</Label>
              <Select
                value={formData.targetGender}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    targetGender: value as typeof formData.targetGender,
                    targetGenderCustom: "",
                  })
                }
                required
                disabled={isSubmitting}
              >
                <SelectTrigger id="targetGender">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetAgeRange">Age Range *</Label>
              <Select
                value={formData.targetAgeRange}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    targetAgeRange: value as typeof formData.targetAgeRange,
                  })
                }
                required
                disabled={isSubmitting}
              >
                <SelectTrigger id="targetAgeRange">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="18-25">18-25</SelectItem>
                  <SelectItem value="26-35">26-35</SelectItem>
                  <SelectItem value="36-45">36-45</SelectItem>
                  <SelectItem value="46-55">46-55</SelectItem>
                  <SelectItem value="56+">56+</SelectItem>
                </SelectContent>
              </Select>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="targetCity">City/Area *</Label>
              <Input
                id="targetCity"
                value={formData.targetCity}
                onChange={(e) =>
                  setFormData({ ...formData, targetCity: e.target.value })
                }
                placeholder="e.g. Brooklyn, NYC"
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetHobby">Hobby *</Label>
              <Input
                id="targetHobby"
                value={formData.targetHobby}
                onChange={(e) =>
                  setFormData({ ...formData, targetHobby: e.target.value })
                }
                placeholder="e.g. rock climbing"
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetProfession">Profession *</Label>
              <Input
                id="targetProfession"
                value={formData.targetProfession}
                onChange={(e) =>
                  setFormData({ ...formData, targetProfession: e.target.value })
                }
                placeholder="e.g. software engineer"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Video Configuration */}
      <div className="space-y-6 py-6 border-b">
        <div>
          <h4 className="text-lg font-semibold mb-1">Video Configuration</h4>
          <p className="text-sm text-muted-foreground">Choose caller, style, and upload photo</p>
        </div>
        
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6 flex flex-col">
            <div className="space-y-2">
              <Label htmlFor="callerId">Caller *</Label>
              {callersError ? (
                <div className="flex h-10 w-full items-center rounded-md border border-destructive bg-background px-3 py-2 text-sm text-destructive">
                  Error loading callers: {callersError.message}
                </div>
              ) : callersLoading ? (
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                  Loading callers...
                </div>
              ) : callers.length === 0 ? (
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                  No callers available
                </div>
              ) : (
                <Select
                  value={formData.callerId || ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, callerId: value || null })
                  }
                  required
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="callerId">
                    <SelectValue placeholder="Select a caller..." />
                  </SelectTrigger>
                  <SelectContent>
                    {callers.map((caller) => (
                      <SelectItem key={caller.id} value={caller.id}>
                        {caller.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2 flex-1">
              <Label htmlFor="videoStyle">Video Style *</Label>
              <Select
                value={formData.videoStyle && VIDEO_STYLES.includes(formData.videoStyle as typeof VIDEO_STYLES[number]) ? formData.videoStyle : formData.videoStyle ? "custom" : ""}
                onValueChange={(value) => {
                  if (value === "custom") {
                    if (VIDEO_STYLES.includes(formData.videoStyle as typeof VIDEO_STYLES[number])) {
                      setFormData({ ...formData, videoStyle: "" });
                    }
                  } else if (value) {
                    setFormData({ ...formData, videoStyle: value });
                  }
                }}
                required={!formData.videoStyle || VIDEO_STYLES.includes(formData.videoStyle as typeof VIDEO_STYLES[number])}
                disabled={isSubmitting}
              >
                <SelectTrigger id="videoStyle">
                  <SelectValue placeholder="Select a style..." />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_STYLES.map((style) => (
                    <SelectItem key={style} value={style}>
                      {style.charAt(0).toUpperCase() +
                        style.slice(1).replace(/-/g, " ")}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Other (custom)</SelectItem>
                </SelectContent>
              </Select>
              {(!formData.videoStyle || !VIDEO_STYLES.includes(formData.videoStyle as typeof VIDEO_STYLES[number])) && (
                <Input
                  id="videoStyleCustom"
                  value={formData.videoStyle && !VIDEO_STYLES.includes(formData.videoStyle as typeof VIDEO_STYLES[number]) ? formData.videoStyle : ""}
                  onChange={(e) =>
                    setFormData({ ...formData, videoStyle: e.target.value })
                  }
                  placeholder="Enter custom style"
                  required
                  disabled={isSubmitting}
                  className="mt-2"
                />
              )}
              <p className="text-xs text-muted-foreground">
                Choose from suggested styles or enter your own custom aesthetic.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Upload their photo</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={isSubmitting || isUploadingImage}
            />
            {formData.uploadedImageUrl ? (
              <div className="relative border-2 border-dashed rounded-lg p-6 h-[192px] flex items-center justify-center">
                <img
                  src={formData.uploadedImageUrl}
                  alt="Uploaded"
                  className="max-w-full max-h-[160px] object-contain rounded-lg"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveImage}
                  disabled={isSubmitting}
                  className="absolute top-2 right-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary cursor-pointer transition-colors h-[192px] flex flex-col items-center justify-center"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-1">
                  Click to upload
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG up to 5MB
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Additional Information */}
      <div className="space-y-6 py-6 border-b">
        <div>
          <h4 className="text-lg font-semibold mb-1">Additional Information</h4>
          <p className="text-sm text-muted-foreground">Help us personalize the call</p>
        </div>
        
        <div className="space-y-6">
          {/* Physical Description - Required if no image, Optional if image uploaded */}
          {!formData.uploadedImageUrl && (
            <div className="space-y-2">
              <Label htmlFor="targetPhysicalDescription">
                Physical Description *
                <span className="text-muted-foreground text-xs ml-2"></span>
              </Label>
              <Textarea
                id="targetPhysicalDescription"
                value={formData.targetPhysicalDescription}
                onChange={(e) =>
                  setFormData({ ...formData, targetPhysicalDescription: e.target.value })
                }
                placeholder="e.g. short brown hair, glasses, casual t-shirt"
                rows={2}
                required
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Required if no photo uploaded but we really suggest you upload one.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="interestingPiece">
              One thing virtually no one knows about them *
              <span className="text-muted-foreground text-xs ml-2"></span>
            </Label>
            <Textarea
              id="interestingPiece"
              value={formData.interestingPiece}
              onChange={(e) =>
                setFormData({ ...formData, interestingPiece: e.target.value })
              }
              placeholder="e.g. 'they secretly still sleep with their childhood teddy bear'"
              rows={2}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ragebaitTrigger">
              If you wanted to ragebait them, you would say... *
              <span className="text-muted-foreground text-xs ml-2"></span>
            </Label>
            <Textarea
              id="ragebaitTrigger"
              value={formData.ragebaitTrigger}
              onChange={(e) =>
                setFormData({ ...formData, ragebaitTrigger: e.target.value })
              }
              placeholder="e.g. 'their favorite sports team is overrated'"
              rows={2}
              required
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>
      </>
      )}

      {/* Privacy & Encryption Section - Show for both modes */}
      <div className="space-y-6 py-6 border-b">
        <div>
          <h4 className="text-lg font-semibold mb-1">Privacy & Encryption</h4>
          <p className="text-sm text-muted-foreground">Choose how your phone number is encrypted</p>
        </div>
        
        <FhenixPrivacyToggle
          value={privacyMode}
          onChange={setPrivacyMode}
          disabled={isSubmitting}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-center pt-6">
        <Button
          type="submit"
          size="lg"
          className={`max-w-sm text-base ${
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
      </div>

      {/* Terms notice */}
      <p className="text-xs text-muted-foreground pt-4 text-center">
        By clicking the button or purchasing, you agree to the{" "}
        <Link to="/terms" className="underline hover:text-primary">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link to="/privacy" className="underline hover:text-primary">
          Privacy Policy
        </Link>
      </p>

      {/* NSFW Warning Footer */}
      <p className="text-xs text-muted-foreground text-center">
        ⚠️ <strong>NSFW content is not supported.</strong> Calls with inappropriate content will fail.
      </p>
      </form>
      {/* Auth Modal - shown when not logged in */}
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onAuthSuccess={handleAuthSuccess}
        initialMode="signup"
      />
      {/* Payment Modal - shown after auth (or immediately if logged in) */}
      <PaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        onPaymentComplete={handlePaymentComplete}
        callDetails={{
          recipientName: formData.recipientName,
          phoneNumber: privacyMode === "fhenix" && fhenixVaultId 
            ? `fhenix:${fhenixVaultId}` 
            : formData.phoneNumber,
          callerId: formData.callerId || undefined,
          targetGender: formData.targetGender,
          targetGenderCustom: formData.targetGenderCustom,
          targetAgeRange: formData.targetAgeRange,
          targetCity: formData.targetCity,
          targetHobby: formData.targetHobby,
          targetProfession: formData.targetProfession,
          interestingPiece: formData.interestingPiece,
          ragebaitTrigger: formData.ragebaitTrigger,
          videoStyle: formData.videoStyle,
          uploadedImageUrl: formData.uploadedImageUrl,
          uploadedImageS3Key: formData.uploadedImageS3Key,
          // Fhenix FHE encryption
          fhenixEnabled: privacyMode === "fhenix",
          fhenixVaultId: fhenixVaultId || undefined,
        }}
      />
    </>
  );
}
