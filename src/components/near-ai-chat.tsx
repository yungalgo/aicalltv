"use client";

import { useState, useRef, useEffect } from "react";
import { Paperclip, X, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "~/components/ui/ai/conversation";
import {
  Message,
  MessageContent,
  MessageAvatar,
} from "~/components/ui/ai/message";
import nearLogoUrl from "~/assets/logos/near-logo.svg";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "~/components/ui/ai/prompt-input";
import { toast } from "sonner";
import { useSuspenseQuery } from "@tanstack/react-query";
import { authQueryOptions } from "~/lib/auth/queries";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ExtractedData {
  recipientName?: string;
  phoneNumber?: string;
  targetGender?: "male" | "female" | "prefer_not_to_say" | "other";
  targetGenderCustom?: string;
  targetAgeRange?: "" | "18-25" | "26-35" | "36-45" | "46-55" | "56+";
  targetCity?: string;
  targetHobby?: string;
  targetProfession?: string;
  targetPhysicalDescription?: string;
  interestingPiece?: string;
  ragebaitTrigger?: string;
  callerId?: string;
  videoStyle?: string;
  uploadedImageUrl?: string;
  uploadedImageS3Key?: string;
}

interface ValidationError {
  field: string;
  message: string;
}

interface NearAiChatProps {
  onFormFill: (data: ExtractedData) => void;
  onComplete: (data: ExtractedData) => void;
}

export function NearAiChat({ onFormFill, onComplete }: NearAiChatProps) {
  const { data: user } = useSuspenseQuery(authQueryOptions());
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hey, I'll help you set up your AI call. First, who are we calling and what's their phone number?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData>({});
  const [isComplete, setIsComplete] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isRetryingValidation, setIsRetryingValidation] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Log extracted data whenever it changes
  useEffect(() => {
    console.log("[NEAR AI Chat] Extracted data updated:", extractedData);
    onFormFill(extractedData);
  }, [extractedData, onFormFill]);

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      toast.error("Please log in to upload an image");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

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
      setExtractedData((prev) => ({
        ...prev,
        uploadedImageUrl: result.url,
        uploadedImageS3Key: result.key,
      }));
      toast.success("Image uploaded! We'll use it in your video");
      console.log("[NEAR AI Chat] Image uploaded:", result);
    } catch (error) {
      console.error("[NEAR AI Chat] Image upload error:", error);
      toast.error("Failed to upload image. Please try again.");
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Remove uploaded image
  const handleRemoveImage = () => {
    setExtractedData((prev) => {
      const { uploadedImageUrl, uploadedImageS3Key, ...rest } = prev;
      return rest;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Build conversation history (excluding welcome message, including the new user message)
      const conversationHistory = [
        ...messages.filter((m) => m.id !== "welcome").map((m) => ({ role: m.role, content: m.content })),
        { role: userMessage.role, content: userMessage.content },
      ];

      const response = await fetch("/api/near-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory,
          currentData: extractedData, // Include current extracted data so AI knows what's already filled
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();

      // Handle validation errors - don't show them during normal conversation
      // Only store them if form is complete (edge case), otherwise clear them
      if (data.validationErrors && data.validationErrors.length > 0) {
        // Only keep validation errors if form is marked complete (edge case)
        // During normal conversation, clear them and let AI ask naturally
        if (data.isComplete) {
          setValidationErrors(data.validationErrors);
        } else {
          // Clear validation errors during normal conversation flow
          setValidationErrors([]);
        }
        
        // Add assistant message
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.message,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Update extracted data (merge with existing)
        if (data.extractedData) {
          setExtractedData((prev) => {
            const merged = { ...prev };
            // Only update fields that have values
            Object.entries(data.extractedData).forEach(([key, value]) => {
              if (value !== null && value !== undefined && value !== "") {
                (merged as Record<string, unknown>)[key] = value;
              }
            });
            return merged;
          });
        }
        
        // Update completion status
        if (data.isComplete) {
          setIsComplete(true);
        }
        
        // Don't automatically retry - let the AI naturally ask for more info
        return;
      }

      // Clear validation errors if validation passed
      setValidationErrors([]);
      setIsRetryingValidation(false);

      // Add assistant message
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.message,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update extracted data (merge with existing)
      if (data.extractedData) {
        setExtractedData((prev) => {
          const merged = { ...prev };
          // Only update fields that have values
          Object.entries(data.extractedData).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== "") {
              (merged as Record<string, unknown>)[key] = value;
            }
          });
          return merged;
        });
      }

      // Check if form is complete
      if (data.isComplete) {
        setIsComplete(true);
      }
    } catch (error) {
      console.error("[NearAiChat] Error:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I had trouble processing that. ${error instanceof Error ? error.message : "Please try again."}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Retry with validation errors
  const handleRetryWithErrors = async (errors: ValidationError[]) => {
    setIsLoading(true);
    
    try {
      // Build conversation history (excluding welcome message)
      const conversationHistory = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch("/api/near-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "", // Empty message, just sending validation errors
          conversationHistory,
          validationErrors: errors,
          currentData: extractedData, // Include current extracted data
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Don't show error - just stop retrying and let user continue naturally
        setIsRetryingValidation(false);
        setValidationErrors([]);
        return;
      }

      const data = await response.json();

      // Add assistant message
      const assistantMessage: Message = {
        id: `assistant-retry-${Date.now()}`,
        role: "assistant",
        content: data.message,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update extracted data
      if (data.extractedData) {
        setExtractedData((prev) => {
          const merged = { ...prev };
          Object.entries(data.extractedData).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== "") {
              (merged as Record<string, unknown>)[key] = value;
            }
          });
          return merged;
        });
      }

      // Check if still has validation errors
      if (data.validationErrors && data.validationErrors.length > 0) {
        setValidationErrors(data.validationErrors);
        // Don't retry again to avoid infinite loop
        setIsRetryingValidation(false);
      } else {
        setValidationErrors([]);
        setIsRetryingValidation(false);
        if (data.isComplete) {
          setIsComplete(true);
        }
      }
    } catch (error) {
      console.error("[NearAiChat] Retry error:", error);
      // Don't show error message - just stop retrying and let user continue conversation
      setIsRetryingValidation(false);
      // Clear validation errors so user can continue naturally
      setValidationErrors([]);
    } finally {
      setIsLoading(false);
    }
  };

  // When form is complete, automatically fill the parent form and let Buy button handle payment
  useEffect(() => {
    if (isComplete && validationErrors.length === 0) {
      console.log("[NEAR AI Chat] Form complete, calling onComplete:", extractedData);
      onComplete(extractedData);
    }
  }, [isComplete, validationErrors.length, extractedData, onComplete]);

  const handleReset = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `Hey, I'm here to help you set up your AI call. Just describe what you want in natural language.`,
      },
    ]);
    setExtractedData({});
    setIsComplete(false);
    setValidationErrors([]);
    setIsRetryingValidation(false);
    setInput("");
  };

  const hasExtractedData = Object.keys(extractedData).length > 0;

  return (
    <div className="flex flex-col">
      {/* Messages */}
      <Conversation className="min-h-[180px] max-h-[280px] mb-4">
        <ConversationContent>
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent
                className="border-2"
                style={{ 
                  backgroundColor: '#fffcf2', 
                  borderColor: '#1A1A1A',
                  color: '#1A1A1A'
                }}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
              </MessageContent>
              <MessageAvatar
                name={message.role === "user" ? "You" : "NEAR AI"}
                src={message.role === "assistant" ? nearLogoUrl : undefined}
                className={
                  message.role === "user"
                    ? undefined
                    : "bg-white border-2 border-[#1A1A1A]"
                }
              />
            </Message>
          ))}
          {isLoading && (
            <Message from="assistant">
              <MessageContent className="border-2" style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A' }}>
                <div className="flex gap-1.5 items-center">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#1A1A1A' }} />
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#1A1A1A', animationDelay: "0.2s" }} />
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#1A1A1A', animationDelay: "0.4s" }} />
                </div>
              </MessageContent>
              <MessageAvatar
                name="NEAR AI"
                src={nearLogoUrl}
                className="bg-white border-2 border-[#1A1A1A]"
              />
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Validation Errors Display - only show when form is complete but has errors */}
      {validationErrors.length > 0 && isComplete && (
        <div className="rounded-xl p-4 mb-4 bg-destructive/10 border border-destructive/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">⚠️</span>
            <p className="text-xs font-semibold text-destructive">Validation Errors</p>
          </div>
          <ul className="space-y-1 text-xs text-destructive/80">
            {validationErrors.map((error, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>
                  <span className="font-medium">{error.field}:</span> {error.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Input Area */}
      <div className="space-y-3">
        <PromptInput
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={isUploadingImage}
            className="hidden"
            id="near-ai-image-upload"
          />
          <Button
            type="button"
            size="icon"
            disabled={isUploadingImage}
            className="shrink-0"
            title={extractedData.uploadedImageUrl ? "Change photo" : "Upload photo"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            {isUploadingImage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
            <span className="sr-only">Upload photo</span>
          </Button>
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isComplete ? "Add more details..." : "Describe your call..."}
            disabled={isLoading}
            className="flex-1"
          />
          <PromptInputSubmit
            status={isLoading ? "loading" : "idle"}
            disabled={!input.trim() || isLoading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              sendMessage();
            }}
          />
        </PromptInput>

        {/* Image Preview */}
        {extractedData.uploadedImageUrl && (
          <div className="flex items-center gap-2 px-2">
            <img 
              src={extractedData.uploadedImageUrl} 
              alt="Uploaded" 
              className="h-10 w-10 rounded object-cover"
            />
            <span className="text-xs text-muted-foreground flex-1">
              Photo uploaded - physical description not required
            </span>
            <button
              onClick={handleRemoveImage}
              className="p-1 hover:bg-destructive/10 rounded transition-colors"
              type="button"
              title="Remove photo"
            >
              <X className="h-4 w-4 text-destructive" />
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {messages.length > 1 && (
            <button
              onClick={handleReset}
              className="flex-1 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ↺ Start Over
            </button>
          )}
        </div>
      </div>

      {/* Extracted Data Preview - Below input box */}
      {hasExtractedData && (
        <div className="rounded-xl p-4 mb-4 border" style={{ backgroundColor: '#f5f5f5', borderColor: '#1A1A1A' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#1A1A1A' }}>
              <span className="text-base">📋</span> Extracted Details
            </p>
            {isComplete && validationErrors.length === 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30">
                ✓ READY
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {extractedData.recipientName && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#1A1A1A', opacity: 0.7 }}>👤</span>
                <span className="font-medium" style={{ color: '#1A1A1A' }}>{extractedData.recipientName}</span>
              </div>
            )}
            {extractedData.phoneNumber && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#1A1A1A', opacity: 0.7 }}>📱</span>
                <span className="font-medium font-mono text-xs" style={{ color: '#1A1A1A' }}>{extractedData.phoneNumber}</span>
              </div>
            )}
            {extractedData.targetGender && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#1A1A1A', opacity: 0.7 }}>⚧</span>
                <span style={{ color: '#1A1A1A' }}>{extractedData.targetGender}</span>
              </div>
            )}
            {extractedData.targetAgeRange && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#1A1A1A', opacity: 0.7 }}>🎂</span>
                <span style={{ color: '#1A1A1A' }}>{extractedData.targetAgeRange}</span>
              </div>
            )}
            {extractedData.targetCity && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#1A1A1A', opacity: 0.7 }}>📍</span>
                <span style={{ color: '#1A1A1A' }}>{extractedData.targetCity}</span>
              </div>
            )}
            {extractedData.targetHobby && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#1A1A1A', opacity: 0.7 }}>🎨</span>
                <span style={{ color: '#1A1A1A' }}>{extractedData.targetHobby}</span>
              </div>
            )}
            {extractedData.targetProfession && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#1A1A1A', opacity: 0.7 }}>💼</span>
                <span style={{ color: '#1A1A1A' }}>{extractedData.targetProfession}</span>
              </div>
            )}
            {extractedData.videoStyle && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#1A1A1A', opacity: 0.7 }}>🎬</span>
                <span style={{ color: '#1A1A1A' }}>{extractedData.videoStyle}</span>
              </div>
            )}
          </div>
          {(extractedData.uploadedImageUrl || extractedData.targetPhysicalDescription) && (
            <div className="mt-3 pt-3" style={{ borderTopWidth: '1px', borderColor: '#1A1A1A' }}>
              <p className="text-xs mb-1" style={{ color: '#1A1A1A', opacity: 0.7 }}>Physical Description:</p>
              {extractedData.uploadedImageUrl ? (
                <p className="text-sm flex items-center gap-1.5" style={{ color: '#1A1A1A' }}>
                  <span>📷</span>
                  <span>Image uploaded</span>
                </p>
              ) : (
                <p className="text-sm" style={{ color: '#1A1A1A' }}>{extractedData.targetPhysicalDescription}</p>
              )}
            </div>
          )}
          {extractedData.interestingPiece && (
            <div className="mt-3 pt-3" style={{ borderTopWidth: '1px', borderColor: '#1A1A1A' }}>
              <p className="text-xs mb-1" style={{ color: '#1A1A1A', opacity: 0.7 }}>Personal Hook:</p>
              <p className="text-sm italic" style={{ color: '#1A1A1A' }}>"{extractedData.interestingPiece}"</p>
            </div>
          )}
          {extractedData.ragebaitTrigger && (
            <div className="mt-3 pt-3" style={{ borderTopWidth: '1px', borderColor: '#1A1A1A' }}>
              <p className="text-xs mb-1" style={{ color: '#1A1A1A', opacity: 0.7 }}>Ragebait Trigger:</p>
              <p className="text-sm italic" style={{ color: '#1A1A1A' }}>"{extractedData.ragebaitTrigger}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

