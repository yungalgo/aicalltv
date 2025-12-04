import { createServerFn } from "@tanstack/react-start";
import { drizzle } from "drizzle-orm/postgres-js";
import { createPostgresDriver } from "~/lib/db";
import { z } from "zod";
import { calls } from "~/lib/db/schema/calls";
import * as schema from "~/lib/db/schema";
import { auth } from "~/lib/auth/auth";
import { getRequest } from "@tanstack/react-start/server";
import { consumeCredit } from "~/lib/credits/functions";

const createCallSchema = z.object({
  recipientName: z.string().min(1, "Recipient name is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  // Caller selection
  callerId: z.string().uuid("Invalid caller ID"), // Required: UUID of selected caller
  // Target person details
  targetGender: z.enum(["male", "female", "prefer_not_to_say", "other"]),
  targetGenderCustom: z.string().optional(), // Required if gender is "other"
  targetAgeRange: z.enum(["18-25", "26-35", "36-45", "46-55", "56+"]).optional(),
  targetPhysicalDescription: z.string().optional(), // New personalization fields
  targetCity: z.string().optional(),
  targetHobby: z.string().optional(),
  targetProfession: z.string().optional(),
  interestingPiece: z.string().optional(), // "One thing virtually no one knows about them"
  ragebaitTrigger: z.string().optional(), // "If you wanted to ragebait them..."
  videoStyle: z.string().min(1, "Video style is required"), // Aesthetic style
  // Optional uploaded image
  uploadedImageUrl: z.string().optional(),
  uploadedImageS3Key: z.string().optional(),
  // Fhenix FHE encryption fields
  fhenixEnabled: z.boolean().optional().default(false),
  fhenixVaultId: z.string().optional(), // bytes32 callId from PIIVault contract
}).refine(
  (data) => {
    // If gender is "other", genderCustom must be provided
    if (data.targetGender === "other" && !data.targetGenderCustom?.trim()) {
      return false;
    }
    return true;
  },
  {
    message: "Custom gender is required when 'other' is selected",
    path: ["targetGenderCustom"],
  },
).refine(
  (data) => {
    // If fhenixEnabled, vaultId must be provided
    if (data.fhenixEnabled && !data.fhenixVaultId) {
      return false;
    }
    return true;
  },
  {
    message: "Fhenix vault ID is required when FHE encryption is enabled",
    path: ["fhenixVaultId"],
  },
);

export type CreateCallInput = z.infer<typeof createCallSchema>;

export const createCall = createServerFn({ method: "POST" }).handler(
  async ({ data: input }: { data: unknown }) => {
    try {
      // Validate input with Zod
    const data = createCallSchema.parse(input);
      
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: getRequest().headers,
    });

    if (!session?.user) {
        throw new Error("Unauthorized - Please sign in to create a call");
    }

    const userId = session.user.id;
      console.log(`[Create Call] ✅ Authenticated user: ${session.user.email}`);

    // Create database connection with Neon-optimized settings
    const driver = createPostgresDriver();
    const db = drizzle({ client: driver, schema, casing: "snake_case" });

    // Handle Fhenix FHE encryption vs legacy encryption
    let encryptedHandle: string;
    
    if (data.fhenixEnabled && data.fhenixVaultId) {
      // Fhenix mode: phone is encrypted on-chain, we store the vault reference
      // Format: fhenix:0x... (bytes32 callId in PIIVault contract)
      encryptedHandle = `fhenix:${data.fhenixVaultId}`;
      console.log(`[Create Call] 🔐 Using Fhenix FHE encryption, vaultId: ${data.fhenixVaultId}`);
    } else {
      // Legacy mode: encrypt phone number server-side
      encryptedHandle = `encrypted_${data.phoneNumber}`;
      console.log(`[Create Call] Using legacy phone encryption`);
    }

    // Fetch caller data for prompt generation
    let callerData: { name: string; personality: string; speakingStyle: string; appearanceDescription?: string } | undefined;
    if (data.callerId) {
      const { eq } = await import("drizzle-orm");
      const [caller] = await db
        .select({
          name: schema.callers.name,
          personality: schema.callers.personality,
          speakingStyle: schema.callers.speakingStyle,
          appearanceDescription: schema.callers.appearanceDescription,
        })
        .from(schema.callers)
        .where(eq(schema.callers.id, data.callerId))
        .limit(1);
      
      if (caller) {
        callerData = {
          name: caller.name,
          personality: caller.personality,
          speakingStyle: caller.speakingStyle,
          appearanceDescription: caller.appearanceDescription,
        };
        console.log(`[Create Call] 📞 Using caller: ${caller.name}`);
      } else {
        console.warn(`[Create Call] ⚠️ Caller ${data.callerId} not found, proceeding without caller personality`);
      }
    }

    // Generate OpenAI prompt using Groq (needed BEFORE call starts)
    const promptInput = {
      targetPerson: {
        name: data.recipientName,
        gender: data.targetGender,
        genderCustom: data.targetGenderCustom,
        ageRange: data.targetAgeRange,
        physicalDescription: data.targetPhysicalDescription,
        city: data.targetCity,
        hobby: data.targetHobby,
        profession: data.targetProfession,
        interestingPiece: data.interestingPiece,
        ragebaitTrigger: data.ragebaitTrigger,
      },
      videoStyle: data.videoStyle,
      hasUploadedImage: !!data.uploadedImageUrl,
      caller: callerData,
    };

    // Generate OpenAI prompt and welcome greeting - needed BEFORE call starts
    // Time the prompt generation for debugging
    const promptStartTime = Date.now();
    console.log(`[Create Call] 🕐 Starting prompt generation...`);
    
    let openaiPrompt: string;
    let welcomeGreeting: string;
    try {
      const { generateCallPrompts } = await import("~/lib/prompts/groq-generator");
      const prompts = await generateCallPrompts(promptInput);
      openaiPrompt = prompts.systemPrompt;
      welcomeGreeting = prompts.welcomeGreeting;
      const promptDuration = Date.now() - promptStartTime;
      console.log(`[Create Call] ✅ Generated prompts in ${promptDuration}ms`);
      console.log(`[Create Call]    Welcome: "${welcomeGreeting.substring(0, 50)}..."`);
    } catch (error) {
      const promptDuration = Date.now() - promptStartTime;
      console.error(`[Create Call] ❌ Failed to generate prompts after ${promptDuration}ms:`, error);
      throw new Error(`Failed to generate prompts: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Note: Image prompt will be generated later in video-generator worker after call completes

    // Create call record with prompt_ready status
    // Status: prompt_ready → Call is ready to be processed (has OpenAI prompt)
    // Note: paymentMethod and isFree will be updated after consuming credit
    const [newCall] = await db
      .insert(calls)
      .values({
        userId,
        callerId: data.callerId || null, // Selected caller
        recipientName: data.recipientName,
        targetGender: data.targetGender,
        targetGenderCustom: data.targetGenderCustom || null,
        targetAgeRange: data.targetAgeRange || null,
        targetPhysicalDescription: data.targetPhysicalDescription || null,
        // New personalization fields
        targetCity: data.targetCity || null,
        targetHobby: data.targetHobby || null,
        targetProfession: data.targetProfession || null,
        interestingPiece: data.interestingPiece || null,
        ragebaitTrigger: data.ragebaitTrigger || null,
        videoStyle: data.videoStyle,
        // Optional uploaded image
        uploadedImageUrl: data.uploadedImageUrl || null,
        uploadedImageS3Key: data.uploadedImageS3Key || null,
        openaiPrompt,
        welcomeGreeting,
        imagePrompt: null, // Will be generated later in video-generator worker
        encryptedHandle,
        // Fhenix FHE encryption fields
        fhenixEnabled: data.fhenixEnabled || false,
        fhenixVaultId: data.fhenixVaultId || null,
        paymentMethod: "free", // Temporary - will be updated from credit
        isFree: false, // Will be updated from credit
        status: "prompt_ready", // Status indicates prompt is ready
      })
      .returning();

    // SECURITY: Consume a credit for this call
    // This is the core of payment verification - no credit = no call
    try {
      const creditInfo = await consumeCredit(db, userId, newCall.id);
      console.log(`[Create Call] ✅ Credit consumed for call ${newCall.id} (method: ${creditInfo.paymentMethod})`);
      
      // Update call with actual payment method and transaction hash from credit
      const { eq } = await import("drizzle-orm");
      // Cast payment method to the enum type
      type PaymentMethod = "free" | "sol_usdc" | "base_usdc" | "zcash" | "ztarknet" | "credit_card";
      await db.update(calls)
        .set({
          paymentMethod: creditInfo.paymentMethod as PaymentMethod,
          isFree: creditInfo.isFree,
          paymentTxHash: creditInfo.paymentRef || null, // Store transaction hash from credit
        })
        .where(eq(calls.id, newCall.id));
      
      // Update local object for return
      (newCall as { paymentMethod: string }).paymentMethod = creditInfo.paymentMethod;
      newCall.isFree = creditInfo.isFree;
    } catch {
      // No credit available - delete the call we just created
      const { eq } = await import("drizzle-orm");
      await db.delete(calls).where(eq(calls.id, newCall.id));
      console.log(`[Create Call] ❌ No credit available, deleted call ${newCall.id}`);
      throw new Error("Payment required. Please purchase a call credit first.");
    }
    
    console.log(`[Create Call] ✅ Call created with status: prompt_ready (ID: ${newCall.id})`);

    // Close database connection
    await driver.end();

    // Enqueue job for async processing by pg-boss worker
    const { getBoss, JOB_TYPES } = await import("~/lib/queue/boss");
    const boss = await getBoss();
    
    // In development, testing mode, or if BYPASS_CALLING_HOURS is set, bypass time restrictions
    const bypassTimeRestrictions = process.env.NODE_ENV !== "production" || 
                                   process.env.TESTING_MODE === "true" || 
                                   process.env.BYPASS_CALLING_HOURS === "true";
    
    if (bypassTimeRestrictions) {
      // Bypass time checks and call immediately
      await boss.send(JOB_TYPES.PROCESS_CALL, {
        callId: newCall.id,
      });
      console.log(`[Create Call] ⏰ BYPASS MODE: Enqueued call ${newCall.id} for immediate processing (time restrictions bypassed)`);
    } else {
      // Production mode: check calling hours
      const { isWithinCallingHours } = await import("~/lib/calls/retry-logic");
      const canCallNow = isWithinCallingHours(encryptedHandle);
      
      if (canCallNow) {
        // Within calling hours - process immediately
        await boss.send(JOB_TYPES.PROCESS_CALL, {
          callId: newCall.id,
        });
        console.log(`[Create Call] Enqueued call ${newCall.id} for immediate processing`);
      } else {
        // Outside calling hours - schedule for next available time slot
        const { calculateNextRetryTime } = await import("~/lib/calls/retry-logic");
        const nextRetryAt = calculateNextRetryTime(encryptedHandle, 0);
        
        if (nextRetryAt) {
          await boss.send(
            JOB_TYPES.PROCESS_CALL,
            { callId: newCall.id },
            { startAfter: nextRetryAt }
          );
          console.log(`[Create Call] Scheduled call ${newCall.id} for ${nextRetryAt}`);
        } else {
          console.error(`[Create Call] Could not schedule call ${newCall.id} - no valid time slot`);
        }
      }
    }

    return {
      success: true,
      callId: newCall.id,
      call: newCall,
    };
    } catch (error) {
      console.error(`[Create Call] ❌ Error:`, error);
      // Re-throw to let TanStack Start handle it properly
      throw error;
    }
  },
);

