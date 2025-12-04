import { createFileRoute } from "@tanstack/react-router";
import OpenAI from "openai";
import { env } from "~/env/server";
import { VIDEO_STYLES } from "~/lib/constants/video-styles";
import { validateCallFormData, type CallFormData, type ValidationError } from "~/lib/validation/call-form";
import { createPostgresDriver } from "~/lib/db";
import { drizzle } from "drizzle-orm/postgres-js";
import { callers } from "~/lib/db/schema/callers";
import { eq, asc } from "drizzle-orm";
import * as schema from "~/lib/db/schema";

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

// System prompt for NEAR AI agent - build dynamically to include VIDEO_STYLES and callers
async function getSystemPrompt(): Promise<string> {
  // Fetch available callers
  const driver = createPostgresDriver();
  const db = drizzle({ client: driver, schema, casing: "snake_case" });
  
  let callersList = "No callers available";
  try {
    const activeCallers = await db
      .select({
        id: callers.id,
        name: callers.name,
        tagline: callers.tagline,
      })
      .from(callers)
      .where(eq(callers.isActive, true))
      .orderBy(asc(callers.displayOrder));
    
    // Format as numbered list for better readability in prompt
    callersList = activeCallers.map((c, idx) => `${idx + 1}. ${c.name} (ID: ${c.id})`).join("\n");
  } catch (error) {
    console.error("[NEAR AI] Error fetching callers:", error);
  } finally {
    await driver.end();
  }

  return `You're an AI assistant helping users set up AI phone calls on aicall.tv. Extract information from natural language and ask for missing required fields.

## CRITICAL: ALL 12 fields must be filled before isComplete=true

### Required Fields:
1. **recipientName** - Person's name
2. **phoneNumber** - US phone (10 digits, formats: +1 555-123-4567, (555) 123-4567, 555-123-4567)
3. **targetGender** - male, female, prefer_not_to_say, or other (+ targetGenderCustom if other)
4. **targetAgeRange** - 18-25, 26-35, 36-45, 46-55, or 56+
5. **targetCity** - City/area where they live
6. **targetHobby** - Their hobby or interest
7. **targetProfession** - Their job/profession
8. **targetPhysicalDescription** - Physical description (ONLY ask if no image uploaded - prioritize image upload first)
9. **callerId** - UUID from available callers (ALWAYS show full list when asking):
${callersList}
10. **videoStyle** - One of: ${VIDEO_STYLES.join(", ")} (default: anime). ALWAYS show full list when asking.
11. **interestingPiece** - Personal detail about them (e.g., "loves their dog Biscuit", "just got promoted", "collects vintage watches"). NOT a message to deliver.
12. **ragebaitTrigger** - What would trigger them? (e.g., "mention their ex", "bring up politics", "criticize their favorite team")

### Field Definitions:
- **interestingPiece**: A fact/personality trait about the person, not what to say to them
- **ragebaitTrigger**: What topic would make them react strongly (for content generation)
- **targetPhysicalDescription**: ONLY ask for this if uploadedImageUrl is NOT present. ALWAYS suggest uploading an image first before asking for physical description.

### Your Process - Ask in 3 Batches (ONE batch at a time):
**Batch 1 - Basic Info:** Ask for recipientName, phoneNumber, targetGender, targetAgeRange, targetCity, targetHobby, targetProfession together
**Batch 2 - Video Config:** Ask for targetPhysicalDescription (or image upload), callerId, videoStyle together. When asking:
  - For callerId: Copy the FULL numbered list into your message:
${callersList}
  - For videoStyle: Copy the FULL list into your message: ${VIDEO_STYLES.join(", ")}
**Batch 3 - Additional Details:** Ask for interestingPiece and ragebaitTrigger together

1. Extract what you can from user's message silently (don't confirm what you extracted - the extracted details section shows that)
2. Ask for ONE batch at a time - NEVER mix batches or ask for fields from different batches in one message
3. Don't say "Got X" or "I have Y" - just ask for what's missing directly
4. For Batch 2 (physical description): FIRST suggest "You can upload a photo using the paperclip button, or describe their appearance" - only ask for description if no image uploaded
5. When asking for callerId: ALWAYS copy the FULL numbered list above into your message text
6. When asking for videoStyle: ALWAYS copy the FULL list above into your message text
7. Don't repeat what's already in CURRENT EXTRACTED DATA
8. Be direct and casual - no pleasantries, no confirmations
9. Set isComplete=true ONLY when ALL 12 fields have valid values
10. When isComplete=true, your message MUST include: "Click the 'Buy a Call' button below to proceed."

### Response Format:
CRITICAL: The "message" field must be conversational text ONLY - never include JSON or code blocks in the message. Only the extractedData field contains structured data.

{
  "message": "Your conversational response as plain text (NO JSON, NO code blocks)",
  "extractedData": {
    "recipientName": "string or null",
    "phoneNumber": "string or null",
    "targetGender": "male/female/prefer_not_to_say/other or null",
    "targetGenderCustom": "string or null",
    "targetAgeRange": "18-25/26-35/36-45/46-55/56+ or null",
    "targetCity": "string or null",
    "targetHobby": "string or null",
    "targetProfession": "string or null",
    "targetPhysicalDescription": "string or null",
    "interestingPiece": "string or null",
    "ragebaitTrigger": "string or null",
    "callerId": "UUID string or null",
    "videoStyle": "string or null"
  },
  "isComplete": false,
  "missingRequired": ["field1", "field2"]
}

### Examples:
User: "Call John at 555-123-4567"
Response message: "Need: gender, age range, city, hobby, and profession."

User: "John is 30, lives in NYC, works as a chef, loves cooking"
Response message: "For video setup: you can upload a photo using the paperclip button, or describe their appearance. Also need caller selection and video style. Available callers: [provide full numbered list]. Video styles: ${VIDEO_STYLES.join(", ")}"

User: Provides all Batch 2 fields
Response message: "What's a personal detail about them (like 'loves their dog' or 'just got promoted')? And what topic would trigger them strongly?"

User: Provides all 12 fields
Response message: "All set! Click the 'Buy a Call' button below to proceed."

### CRITICAL RULES:
- "message" field = conversational text ONLY, never JSON or code
- For physical description: ALWAYS suggest image upload first
- When asking for callerId or videoStyle: provide the full list in your message text
- isComplete=true requires ALL 12 fields filled`;
}

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
          const { message, conversationHistory = [], validationErrors, currentData } = body as {
            message?: string;
            conversationHistory?: ConversationMessage[];
            validationErrors?: ValidationError[];
            currentData?: Partial<CallFormData>;
          };

          // Allow empty message if validation errors are present (retry scenario)
          if (!validationErrors || validationErrors.length === 0) {
            if (!message || typeof message !== "string") {
              return new Response(
                JSON.stringify({ error: "Message is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              );
            }
          }

          // Get system prompt with current callers list
          const systemPrompt = await getSystemPrompt();

          // Build messages for NEAR AI
          const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
            { role: "system", content: systemPrompt },
            // Include conversation history
            ...conversationHistory.map((msg) => ({
              role: msg.role as "user" | "assistant",
              content: msg.content,
            })),
          ];

          // Add current extracted data as context so AI knows what's already filled
          if (currentData && Object.keys(currentData).length > 0) {
            const dataSummary = Object.entries(currentData)
              .filter(([_, value]) => value !== null && value !== undefined && value !== "")
              .map(([key, value]) => `- ${key}: ${value}`)
              .join("\n");
            if (dataSummary) {
              messages.push({
                role: "user" as const,
                content: `CURRENT EXTRACTED DATA:\n${dataSummary}\n\nUse this information to avoid asking for things already provided.`,
              });
            }
          }

          // If there are validation errors, add them as context
          if (validationErrors && validationErrors.length > 0) {
            const errorMessages = validationErrors.map(err => `- ${err.field}: ${err.message}`).join("\n");
            messages.push({
              role: "user" as const,
              content: `VALIDATION ERRORS DETECTED:\n${errorMessages}\n\nPlease fix these errors in the extracted data. Either correct the values yourself if you can infer them, or ask the user for clarification.`,
            });
          }

          // Add current user message (if provided)
          if (message && message.trim()) {
            messages.push({ role: "user" as const, content: message });
          }

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
            extractedData: CallFormData & { callerId?: string };
            isComplete: boolean;
            missingRequired: string[];
          };

          try {
            // Try to extract JSON from the response (may be wrapped in markdown)
            const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedResponse = JSON.parse(jsonMatch[0]);
              
              // Clean up message field - remove any JSON or code blocks that AI might have included
              if (parsedResponse.message) {
                // Remove JSON-like structures from message
                parsedResponse.message = parsedResponse.message
                  .replace(/\{[\s\S]*?\}/g, '') // Remove JSON objects
                  .replace(/```[\s\S]*?```/g, '') // Remove code blocks
                  .replace(/`[^`]+`/g, '') // Remove inline code
                  .trim();
                
                // If message is empty after cleaning, provide a fallback
                if (!parsedResponse.message || parsedResponse.message.length === 0) {
                  parsedResponse.message = "Got it. Need a few more details.";
                }
              }
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
                extractedData: {
                  ...validationResult.normalizedData,
                  callerId: parsedResponse.extractedData.callerId || undefined,
                },
                isComplete: false,
                missingRequired: getMissingRequired({ ...validationResult.normalizedData, callerId: parsedResponse.extractedData.callerId }),
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

          // Re-check completeness based on validation result
          const actuallyComplete = validationResult.isValid;

          // Preserve callerId even though it's not in CallFormData
          const responseData = {
            ...validationResult.normalizedData,
            callerId: parsedResponse.extractedData.callerId || undefined,
          };

          // If complete, ensure message includes Buy button instruction
          let finalMessage = parsedResponse.message;
          if (actuallyComplete && !finalMessage.toLowerCase().includes("buy") && !finalMessage.toLowerCase().includes("button")) {
            finalMessage = `${finalMessage} Click the 'Buy a Call' button below to proceed.`;
          }

          return new Response(
            JSON.stringify({
              message: finalMessage,
              extractedData: responseData,
              isComplete: actuallyComplete,
              missingRequired: validationResult.errors.map(e => e.field),
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
function getMissingRequired(data: Partial<CallFormData & { callerId?: string }>): string[] {
  const missing: string[] = [];
  if (!data.recipientName) missing.push("recipientName");
  if (!data.phoneNumber) missing.push("phoneNumber");
  if (!data.targetGender) missing.push("targetGender");
  if (data.targetGender === "other" && !data.targetGenderCustom) missing.push("targetGenderCustom");
  if (!data.targetAgeRange) missing.push("targetAgeRange");
  if (!data.targetCity) missing.push("targetCity");
  if (!data.targetHobby) missing.push("targetHobby");
  if (!data.targetProfession) missing.push("targetProfession");
  if (!data.uploadedImageUrl && !data.uploadedImageS3Key && !data.targetPhysicalDescription) {
    missing.push("targetPhysicalDescription");
  }
  if (!data.callerId) missing.push("callerId");
  if (!data.videoStyle) missing.push("videoStyle");
  if (!data.interestingPiece) missing.push("interestingPiece");
  if (!data.ragebaitTrigger) missing.push("ragebaitTrigger");
  return missing;
}

