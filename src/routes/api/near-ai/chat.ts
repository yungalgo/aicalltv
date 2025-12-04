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

// Cache for callers list to avoid DB queries on every request
let cachedCallersList: string | null = null;
let cachedCallersMap: Map<string, string> | null = null; // name -> id mapping
let cachedCallersListTime: number = 0;
const CALLERS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCallersList(): Promise<{ list: string; nameToIdMap: Map<string, string> }> {
  const now = Date.now();
  if (cachedCallersList && cachedCallersMap && (now - cachedCallersListTime) < CALLERS_CACHE_TTL) {
    return { list: cachedCallersList, nameToIdMap: cachedCallersMap };
  }

  const driver = createPostgresDriver();
  const db = drizzle({ client: driver, schema, casing: "snake_case" });
  
  let callersList = "No callers available";
  const nameToIdMap = new Map<string, string>();
  
  try {
    const activeCallers = await db
      .select({
        id: callers.id,
        name: callers.name,
      })
      .from(callers)
      .where(eq(callers.isActive, true))
      .orderBy(asc(callers.displayOrder));
    
    // Format with names prominently, IDs in parentheses
    callersList = activeCallers.map((c, idx) => {
      nameToIdMap.set(c.name.toLowerCase(), c.id); // Store lowercase for case-insensitive lookup
      return `${idx + 1}. ${c.name}`;
    }).join("\n");
    
    cachedCallersList = callersList;
    cachedCallersMap = nameToIdMap;
    cachedCallersListTime = now;
  } catch (error) {
    console.error("[NEAR AI] Error fetching callers:", error);
  } finally {
    await driver.end();
  }

  return { list: callersList, nameToIdMap };
}

// Helper to map caller name to ID
function getCallerIdFromName(callerName: string | null | undefined, nameToIdMap: Map<string, string>): string | undefined {
  if (!callerName) return undefined;
  return nameToIdMap.get(callerName.toLowerCase().trim());
}

// Concise system prompt - callers list will be added dynamically when needed
function getSystemPrompt(): string {
  return `You're an AI assistant helping users set up AI phone calls. Extract info from natural language and ask for missing fields.

REQUIRED FIELDS (all 12 must be filled before isComplete=true):
1. recipientName, 2. phoneNumber, 3. targetGender, 4. targetAgeRange, 5. targetCity, 6. targetHobby, 7. targetProfession, 8. targetPhysicalDescription (ONLY if no image uploaded), 9. callerId (use caller NAME, not ID), 10. videoStyle, 11. interestingPiece, 12. ragebaitTrigger

PROCESS:
- Ask for ONE missing field at a time
- Extract what you can from user's message silently
- Then ask for the next missing field
- If uploadedImageUrl exists, skip targetPhysicalDescription

RULES:
- Extract silently, don't confirm extracted data
- Ask ONE question at a time - keep it simple
- Be direct - no pleasantries
- Don't repeat what's in CURRENT EXTRACTED DATA
- For callerId: Ask for the CALLER NAME, show all caller names when asking
- For videoStyle: Show all available video styles when asking
- If image is uploaded, don't ask for or extract targetPhysicalDescription
- Never extract image URLs as targetPhysicalDescription
- isComplete=true only when ALL 12 fields filled

RESPONSE FORMAT (CRITICAL):
- "message" field = conversational text ONLY, NEVER JSON or code blocks
- All structured data goes ONLY in "extractedData" field
- The message is displayed to users - make it natural
- For callerId: Extract the CALLER NAME (the system will convert it to ID)

{
  "message": "Your conversational text here",
  "extractedData": {
    "recipientName": "string or null",
    "phoneNumber": "string or null",
    "targetGender": "male/female/prefer_not_to_say/other or null",
    "targetAgeRange": "18-25/26-35/36-45/46-55/56+ or null",
    "targetCity": "string or null",
    "targetHobby": "string or null",
    "targetProfession": "string or null",
    "targetPhysicalDescription": "string or null",
    "callerId": "caller NAME (e.g., 'Sandra the Neighbor') or null",
    "videoStyle": "string or null",
    "interestingPiece": "string or null",
    "ragebaitTrigger": "string or null"
  },
  "isComplete": false
}

CRITICAL: message field must be plain text, never JSON!`;
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

          // Get base system prompt
          let systemPrompt = getSystemPrompt();
          
          // Check if we need callerId or videoStyle - add lists when asking for these
          const currentDataWithCallerId = currentData as Partial<CallFormData & { callerId?: string }>;
          const needsCallerInfo = !currentDataWithCallerId?.callerId || !currentData?.videoStyle;
          
          // Get callers list and mapping (needed for name-to-ID conversion and when asking)
          const callersData = await getCallersList();
          const callersNameToIdMap = callersData.nameToIdMap;
          
          // Add callers list and video styles to prompt when we might need them
          if (needsCallerInfo) {
            const videoStylesList = VIDEO_STYLES.join(", ");
            systemPrompt += `\n\nWhen asking for caller or video style, include these lists:\nAvailable Callers:\n${callersData.list}\nVideo Styles: ${videoStylesList}`;
          }

          // Build messages for NEAR AI
          const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
            { role: "system", content: systemPrompt },
            // Include conversation history
            ...conversationHistory.map((msg) => ({
              role: msg.role as "user" | "assistant",
              content: msg.content,
            })),
          ];

          // Add current extracted data as context - concise format
          if (currentData && Object.keys(currentData).length > 0) {
            const filledFields = Object.entries(currentData)
              .filter(([_, value]) => value !== null && value !== undefined && value !== "")
              .map(([key, value]) => `${key}:${value}`)
              .join(", ");
            if (filledFields) {
              messages.push({
                role: "user" as const,
                content: `Already have: ${filledFields}. Don't ask for these again.`,
              });
            }
          }

          // If there are validation errors, add them as context
          if (validationErrors && validationErrors.length > 0) {
            const errorMessages = validationErrors.map(err => `${err.field}: ${err.message}`).join(", ");
            messages.push({
              role: "user" as const,
              content: `Fix these errors: ${errorMessages}`,
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
              const rawJson = jsonMatch[0];
              parsedResponse = JSON.parse(rawJson);
              
              console.log("[NEAR AI] Parsed response:", {
                messagePreview: parsedResponse.message?.substring(0, 200),
                extractedDataKeys: Object.keys(parsedResponse.extractedData || {}),
                currentDataKeys: Object.keys(currentData || {}),
              });
              
              // Clean up message field - remove any JSON or code blocks that AI might have included
              if (parsedResponse.message) {
                let cleanedMessage = parsedResponse.message.trim();
                
                // Check if the entire message is a JSON string (common mistake)
                if (cleanedMessage.startsWith('{') && cleanedMessage.endsWith('}')) {
                  try {
                    // Try to parse it - if it's valid JSON, extract just the message field if it exists
                    const parsedMessageJson = JSON.parse(cleanedMessage);
                    if (parsedMessageJson.message && typeof parsedMessageJson.message === 'string') {
                      cleanedMessage = parsedMessageJson.message.trim();
                    } else {
                      // If no message field, use fallback
                      cleanedMessage = "Got it. Need a few more details.";
                    }
                  } catch {
                    // Not valid JSON, remove it entirely
                    cleanedMessage = "Got it. Need a few more details.";
                  }
                }
                
                // Remove JSON objects from the message - find text before any JSON
                const jsonStartIndex = cleanedMessage.indexOf('{');
                if (jsonStartIndex > 0) {
                  // There's text before JSON, keep only that part
                  cleanedMessage = cleanedMessage.substring(0, jsonStartIndex).trim();
                } else if (jsonStartIndex === 0) {
                  // Message starts with JSON - this shouldn't happen after the check above, but handle it
                  cleanedMessage = "Got it. Need a few more details.";
                }
                
                // Remove any remaining code blocks
                cleanedMessage = cleanedMessage
                  .replace(/```json[\s\S]*?```/gi, '')
                  .replace(/```[\s\S]*?```/g, '')
                  .replace(/`[^`]+`/g, '')
                  .trim();
                
                // If message is empty after cleaning, provide a fallback
                if (!cleanedMessage || cleanedMessage.length === 0) {
                  cleanedMessage = "Got it. Need a few more details.";
                }
                
                parsedResponse.message = cleanedMessage;
                
                console.log("[NEAR AI] Cleaned message:", cleanedMessage.substring(0, 100));
              } else {
                // No message field, provide fallback
                parsedResponse.message = "Got it. Need a few more details.";
              }
              
              // Merge extractedData with currentData to preserve existing values
              // Start with currentData, then overlay with new extractedData
              // CRITICAL: Only update fields that have actual new values (not null/undefined/empty)
              const merged: Record<string, unknown> = currentData && Object.keys(currentData).length > 0
                ? { ...currentData }
                : {};
              
              // Only add/update fields that have actual values
              if (parsedResponse.extractedData) {
                Object.entries(parsedResponse.extractedData).forEach(([key, value]) => {
                  // Only update if value is not null, undefined, or empty string
                  if (value !== null && value !== undefined && value !== "") {
                    merged[key] = value;
                  }
                });
              }
              
              // Convert caller name to ID if needed
              if (callersNameToIdMap && merged.callerId && typeof merged.callerId === 'string') {
                // Check if it's a UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
                const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (!uuidPattern.test(merged.callerId)) {
                  // It's a name, not an ID - convert it
                  const callerId = getCallerIdFromName(merged.callerId, callersNameToIdMap);
                  if (callerId) {
                    merged.callerId = callerId;
                    console.log("[NEAR AI] Converted caller name to ID:", merged.callerId, "->", callerId);
                  } else {
                    console.warn("[NEAR AI] Could not find ID for caller name:", merged.callerId);
                  }
                }
              }
              
              // If image is uploaded, clear targetPhysicalDescription (don't store URLs as description)
              if (merged.uploadedImageUrl || merged.uploadedImageS3Key) {
                if (merged.targetPhysicalDescription && typeof merged.targetPhysicalDescription === 'string') {
                  // Check if it looks like a URL
                  if (merged.targetPhysicalDescription.startsWith('http://') || 
                      merged.targetPhysicalDescription.startsWith('https://')) {
                    merged.targetPhysicalDescription = '';
                    console.log("[NEAR AI] Cleared targetPhysicalDescription because image is uploaded");
                  }
                }
              }
              
              parsedResponse.extractedData = merged as CallFormData & { callerId?: string };
              
              console.log("[NEAR AI] After merge:", {
                message: parsedResponse.message?.substring(0, 100),
                extractedDataKeys: Object.keys(parsedResponse.extractedData),
              });
            } else {
              // Fallback: treat as plain text
              parsedResponse = {
                message: responseContent,
                extractedData: currentData || {},
                isComplete: false,
                missingRequired: ["recipientName", "phoneNumber"],
              };
            }
          } catch (parseError) {
            console.error("[NEAR AI] Failed to parse response as JSON:", parseError);
            // Fallback: treat as plain text
            parsedResponse = {
              message: responseContent,
              extractedData: currentData || {},
              isComplete: false,
              missingRequired: ["recipientName", "phoneNumber"],
            };
          }

          // Merge with currentData before validation to preserve existing values
          const dataToValidate = currentData && Object.keys(currentData).length > 0
            ? { ...currentData, ...parsedResponse.extractedData }
            : parsedResponse.extractedData;
          
          console.log("[NEAR AI] Data to validate keys:", Object.keys(dataToValidate));
          
          // Validate and normalize extracted data using comprehensive validation
          const validationResult = validateCallFormData(dataToValidate);
          
          // Merge normalized data with original merged data to preserve all fields
          // This ensures fields that weren't validated (like callerId, uploadedImageUrl) are preserved
          const finalMergedData = {
            ...dataToValidate, // Start with all original data
            ...validationResult.normalizedData, // Overlay with normalized/validated data
          };
          
          // If validation failed, return errors so the AI can fix them
          if (!validationResult.isValid) {
            return new Response(
              JSON.stringify({
                message: parsedResponse.message,
                extractedData: finalMergedData,
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

          // Use the final merged data (already includes all fields from dataToValidate + normalized data)
          const responseData = finalMergedData;
          
          console.log("[NEAR AI] Final response data keys:", Object.keys(responseData));

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

