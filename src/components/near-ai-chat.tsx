"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "~/components/ui/button";

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
  interestingPiece?: string;
  videoStyle?: string;
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hey! 👋 I'm here to help you set up your AI call.

Just describe what you want in natural language:
• "Call my friend Mike at 555-123-4567 and prank him"
• "Wish Sarah a happy birthday at 555-987-6543"
• "Set up a call to surprise my coworker"

What would you like to do?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData>({});
  const [isComplete, setIsComplete] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isRetryingValidation, setIsRetryingValidation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update parent with extracted data whenever it changes
  useEffect(() => {
    onFormFill(extractedData);
  }, [extractedData, onFormFill]);

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
      // Build conversation history (excluding welcome message)
      const conversationHistory = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch("/api/near-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();

      // Handle validation errors
      if (data.validationErrors && data.validationErrors.length > 0) {
        setValidationErrors(data.validationErrors);
        
        // Add assistant message with validation errors
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

        // Automatically retry by sending validation errors back to AI
        if (!isRetryingValidation) {
          setIsRetryingValidation(true);
          // Wait a moment, then automatically send validation errors to AI
          setTimeout(() => {
            const errorSummary = data.validationErrors
              .map((err: ValidationError) => `${err.field}: ${err.message}`)
              .join("\n");
            
            // Automatically send a message asking AI to fix errors
            const retryMessage: Message = {
              id: `user-retry-${Date.now()}`,
              role: "user",
              content: `Please fix these validation errors:\n${errorSummary}`,
            };
            setMessages((prev) => [...prev, retryMessage]);
            
            // Call API again with validation errors
            handleRetryWithErrors(data.validationErrors);
          }, 1000);
        }
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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
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
      const errorMessage: Message = {
        id: `error-retry-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I had trouble fixing the validation errors. ${error instanceof Error ? error.message : "Please try again."}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsRetryingValidation(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceed = () => {
    onComplete(extractedData);
  };

  const handleReset = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `Hey! 👋 I'm here to help you set up your AI call.

Just describe what you want in natural language:
• "Call my friend Mike at 555-123-4567 and prank him"
• "Wish Sarah a happy birthday at 555-987-6543"
• "Set up a call to surprise my coworker"

What would you like to do?`,
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
      <div className="overflow-y-auto space-y-3 mb-4 min-h-[180px] max-h-[280px] pr-2 scrollbar-thin scrollbar-thumb-violet-500/30 scrollbar-track-transparent">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/20"
                  : "bg-white/5 text-violet-100 border border-violet-500/20"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-violet-500/20 rounded-2xl px-4 py-3">
              <div className="flex gap-1.5 items-center">
                <span className="w-2 h-2 rounded-full bg-violet-400 typing-dot" />
                <span className="w-2 h-2 rounded-full bg-cyan-400 typing-dot" />
                <span className="w-2 h-2 rounded-full bg-violet-400 typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Validation Errors Display */}
      {validationErrors.length > 0 && (
        <div className="rounded-xl p-4 mb-4 bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">⚠️</span>
            <p className="text-xs font-semibold text-red-300">Validation Errors</p>
          </div>
          <ul className="space-y-1 text-xs text-red-200">
            {validationErrors.map((error, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                <span>
                  <span className="font-medium">{error.field}:</span> {error.message}
                </span>
              </li>
            ))}
          </ul>
          {isRetryingValidation && (
            <p className="text-xs text-violet-300 mt-2 italic">
              AI is fixing these errors...
            </p>
          )}
        </div>
      )}

      {/* Extracted Data Preview */}
      {hasExtractedData && (
        <div className="rounded-xl p-4 mb-4 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-500/30">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
              <span className="text-base">📋</span> Extracted Details
            </p>
            {isComplete && validationErrors.length === 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                ✓ READY
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {extractedData.recipientName && (
              <div className="flex items-center gap-2">
                <span className="text-violet-400/60 text-xs">👤</span>
                <span className="text-white font-medium">{extractedData.recipientName}</span>
              </div>
            )}
            {extractedData.phoneNumber && (
              <div className="flex items-center gap-2">
                <span className="text-violet-400/60 text-xs">📱</span>
                <span className="text-white font-medium font-mono text-xs">{extractedData.phoneNumber}</span>
              </div>
            )}
            {extractedData.targetGender && (
              <div className="flex items-center gap-2">
                <span className="text-violet-400/60 text-xs">⚧</span>
                <span className="text-violet-200">{extractedData.targetGender}</span>
              </div>
            )}
            {extractedData.targetAgeRange && (
              <div className="flex items-center gap-2">
                <span className="text-violet-400/60 text-xs">🎂</span>
                <span className="text-violet-200">{extractedData.targetAgeRange}</span>
              </div>
            )}
            {extractedData.videoStyle && (
              <div className="flex items-center gap-2">
                <span className="text-violet-400/60 text-xs">🎬</span>
                <span className="text-violet-200">{extractedData.videoStyle}</span>
              </div>
            )}
          </div>
          {extractedData.interestingPiece && (
            <div className="mt-3 pt-3 border-t border-violet-500/20">
              <p className="text-xs text-violet-400/60 mb-1">Personal Hook:</p>
              <p className="text-sm text-violet-200 italic">"{extractedData.interestingPiece}"</p>
            </div>
          )}
        </div>
      )}

      {/* Input Area */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isComplete ? "Add more details..." : "Describe your call..."}
              disabled={isLoading}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-violet-500/30 text-white placeholder:text-violet-300/40 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 transition-all"
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-violet-500 hover:to-cyan-500 transition-all shadow-lg shadow-violet-500/20"
          >
            <span className="text-lg">→</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {messages.length > 1 && (
            <button
              onClick={handleReset}
              className="flex-1 py-2 text-sm text-violet-300/60 hover:text-violet-200 transition-colors"
            >
              ↺ Start Over
            </button>
          )}
          
          {isComplete && (
            <Button 
              onClick={handleProceed} 
              className="flex-1 h-12 text-base font-bold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white shadow-lg shadow-green-500/30 rounded-xl"
            >
              ✓ Review & Proceed to Payment
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

