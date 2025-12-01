import { createFileRoute } from "@tanstack/react-router";
import OpenAI from "openai";
import { env } from "~/env/server";
import { VIDEO_STYLES } from "~/lib/constants/video-styles";
import { validateCallFormData, type CallFormData, type ValidationError } from "~/lib/validation/call-form";

// NEAR AI uses OpenAI-compatible API
// Runs in Trusted Execution Environment (TEE) for privacy
const nearAI = new OpenAI({
  baseURL: "https://cloud-api.near.ai/v1",
  apiKey: env.NEAR_AI_API_KEY || "",
});

// Re-export CallFormData from validation module

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// System prompt for NEAR AI agent - build dynamically to include VIDEO_STYLES
const SYSTEM_PROMPT = `You are a helpful AI assistant for AI Call TV - a service that makes personalized AI phone calls with generated videos.

Your job is to help users set up their call by extracting information from their natural language requests.

## Required Information:
1. recipientName (required) - The name of the person to call
2. phoneNumber (required) - Their phone number (must be a valid US format like +1 555-123-4567)

## Optional Information:
3. targetGender - male, female, prefer_not_to_say, or other (if other, also get targetGenderCustom)
4. targetAgeRange - One of: 18-25, 26-35, 36-45, 46-55, 56+
5. interestingPiece - Personal details to make the call more authentic (e.g., "they love their dog Biscuit", "just got promoted")
6. videoStyle - One of: ${VIDEO_STYLES.join(", ")} (default: anime)
7. anythingElse - Any additional context or special requests

## Your Task:
1. Extract as much information as possible from the user's message
2. If required fields (recipientName, phoneNumber) are missing, ask for them naturally
3. Be conversational and friendly - this is for fun/entertainment!
4. When you have all required info, confirm what you understood

## Response Format:
Always respond with valid JSON in this format:
{
  "message": "Your conversational response to the user",
  "extractedData": {
    "recipientName": "extracted name or null",
    "phoneNumber": "extracted phone or null (MUST be US format: +1XXXXXXXXXX or 10 digits)",
    "targetGender": "male/female/prefer_not_to_say/other or null",
    "targetGenderCustom": "if other gender specified",
    "targetAgeRange": "18-25/26-35/36-45/46-55/56+ or null",
    "interestingPiece": "personal details or null (max 500 chars)",
    "videoStyle": "one of: ${VIDEO_STYLES.join(", ")} or null (must match exactly - use lowercase with hyphens)",
    "anythingElse": "extra context or null (max 1000 chars)"
  },
  "isComplete": false,
  "missingRequired": ["list of missing required fields"]
}

Set "isComplete": true only when you have valid recipientName AND phoneNumber (US format, 10 digits).

## Phone Number Format:
- MUST be a US phone number (10 digits)
- Accept formats: +1 555-123-4567, (555) 123-4567, 555-123-4567, 5551234567
- Will be normalized to: +1XXXXXXXXXX

## Examples:
User: "Call my friend John at 555-123-4567 and tell him he won the lottery"
Response: Extract recipientName="John", phoneNumber="555-123-4567", interestingPiece="tell him he won the lottery", isComplete=true

User: "I want to prank call someone"
Response: Ask who to call and their phone number, isComplete=false, missingRequired=["recipientName", "phoneNumber"]

Be fun and engaging! This is an entertainment product.`;

export const Route = createFileRoute("/api/near-ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // Check if NEAR AI is configured
          if (!env.NEAR_AI_API_KEY) {
            return new Response(
              JSON.stringify({ error: "NEAR AI is not configured. Please set NEAR_AI_API_KEY." }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            );
          }

          const body = await request.json();
          const { message, conversationHistory = [], validationErrors } = body as {
            message: string;
            conversationHistory?: ConversationMessage[];
            validationErrors?: ValidationError[];
          };

          if (!message || typeof message !== "string") {
            return new Response(
              JSON.stringify({ error: "Message is required" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // Build messages for NEAR AI
          const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
            { role: "system", content: SYSTEM_PROMPT },
            // Include conversation history
            ...conversationHistory.map((msg) => ({
              role: msg.role as "user" | "assistant",
              content: msg.content,
            })),
          ];

          // If there are validation errors, add them as context
          if (validationErrors && validationErrors.length > 0) {
            const errorMessages = validationErrors.map(err => `- ${err.field}: ${err.message}`).join("\n");
            messages.push({
              role: "user" as const,
              content: `VALIDATION ERRORS DETECTED:\n${errorMessages}\n\nPlease fix these errors in the extracted data. Either correct the values yourself if you can infer them, or ask the user for clarification.`,
            });
          }

          // Add current user message
          messages.push({ role: "user" as const, content: message });

          console.log("[NEAR AI] Sending request with", messages.length, "messages");

          // Call NEAR AI (runs in TEE - private and verifiable)
          const completion = await nearAI.chat.completions.create({
            model: "deepseek-ai/DeepSeek-V3.1",
            messages,
            temperature: 0.7,
            max_tokens: 1000,
          });

          const responseContent = completion.choices[0]?.message?.content;
          
          if (!responseContent) {
            return new Response(
              JSON.stringify({ error: "No response from NEAR AI" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          console.log("[NEAR AI] Response:", responseContent);

          // Parse the JSON response
          let parsedResponse: {
            message: string;
            extractedData: CallFormData;
            isComplete: boolean;
            missingRequired: string[];
          };

          try {
            // Try to extract JSON from the response (may be wrapped in markdown)
            const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedResponse = JSON.parse(jsonMatch[0]);
            } else {
              // Fallback: treat as plain text
              parsedResponse = {
                message: responseContent,
                extractedData: {},
                isComplete: false,
                missingRequired: ["recipientName", "phoneNumber"],
              };
            }
          } catch (parseError) {
            console.error("[NEAR AI] Failed to parse response as JSON:", parseError);
            // Fallback: treat as plain text
            parsedResponse = {
              message: responseContent,
              extractedData: {},
              isComplete: false,
              missingRequired: ["recipientName", "phoneNumber"],
            };
          }

          // Validate and normalize extracted data using comprehensive validation
          const validationResult = validateCallFormData(parsedResponse.extractedData);
          
          // If validation failed, return errors so the AI can fix them
          if (!validationResult.isValid) {
            return new Response(
              JSON.stringify({
                message: parsedResponse.message,
                extractedData: validationResult.normalizedData,
                isComplete: false,
                missingRequired: getMissingRequired(validationResult.normalizedData as CallFormData),
                validationErrors: validationResult.errors,
                // Include TEE attestation info for bounty demonstration
                teeInfo: {
                  provider: "NEAR AI Cloud",
                  model: "deepseek-ai/DeepSeek-V3.1",
                  environment: "Trusted Execution Environment (TEE)",
                  privacy: "User data processed in TEE - cannot be accessed by providers",
                },
              }),
              { headers: { "Content-Type": "application/json" } }
            );
          }

          // Re-check completeness based on normalized data
          const actuallyComplete = !!(validationResult.normalizedData.recipientName && validationResult.normalizedData.phoneNumber);

          return new Response(
            JSON.stringify({
              message: parsedResponse.message,
              extractedData: validationResult.normalizedData,
              isComplete: actuallyComplete,
              missingRequired: getMissingRequired(validationResult.normalizedData as CallFormData),
              validationErrors: [],
              // Include TEE attestation info for bounty demonstration
              teeInfo: {
                provider: "NEAR AI Cloud",
                model: "deepseek-ai/DeepSeek-V3.1",
                environment: "Trusted Execution Environment (TEE)",
                privacy: "User data processed in TEE - cannot be accessed by providers",
              },
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        } catch (error) {
          console.error("[NEAR AI] Error:", error);
          
          // Handle specific API errors
          if (error instanceof OpenAI.APIError) {
            if (error.status === 401) {
              return new Response(
                JSON.stringify({ error: "Invalid NEAR AI API key" }),
                { status: 401, headers: { "Content-Type": "application/json" } }
              );
            }
            if (error.status === 429) {
              return new Response(
                JSON.stringify({ error: "NEAR AI rate limit exceeded. Please try again later." }),
                { status: 429, headers: { "Content-Type": "application/json" } }
              );
            }
          }

          return new Response(
            JSON.stringify({ error: "Failed to process request with NEAR AI" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});

// Get list of missing required fields
function getMissingRequired(data: Partial<CallFormData>): string[] {
  const missing: string[] = [];
  if (!data.recipientName) missing.push("recipientName");
  if (!data.phoneNumber) missing.push("phoneNumber");
  return missing;
}

