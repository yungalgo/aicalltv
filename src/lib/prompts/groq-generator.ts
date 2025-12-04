/**
 * Groq API integration for generating dynamic prompts
 * Uses meta-llama/llama-4-scout-17b-16e-instruct model
 */

import { env } from "~/env/server";
import { getRandomCallerDescription } from "./caller-descriptions";

const GROQ_API_BASE = "https://api.groq.com/openai/v1";
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export interface TargetPersonData {
  name: string;
  gender: "male" | "female" | "prefer_not_to_say" | "other";
  genderCustom?: string; // If gender is "other"
  ageRange?: string; // "18-25", "26-35", "36-45", "46-55", "56+"
  physicalDescription?: string;
  // New personalization fields
  city?: string; // City/area they live in
  hobby?: string; // Their hobby
  profession?: string; // Their job
  interestingPiece?: string; // "One thing virtually no one knows about them"
  ragebaitTrigger?: string; // "If you wanted to ragebait them..."
}

export interface PromptGenerationInput {
  targetPerson: TargetPersonData;
  videoStyle: string; // Aesthetic style: "anime", "claymation", "puppets", etc.
  hasUploadedImage?: boolean; // If true, don't describe target appearance (we have their photo)
}

export interface GeneratedPrompts {
  systemPrompt: string;
  welcomeGreeting: string;
}

/**
 * Generate OpenAI call prompt and welcome greeting using Groq
 */
export async function generateOpenAIPrompt(
  input: PromptGenerationInput,
): Promise<string> {
  const result = await generateCallPrompts(input);
  return result.systemPrompt;
}

/**
 * Generate both system prompt and welcome greeting using Groq
 */
export async function generateCallPrompts(
  input: PromptGenerationInput,
): Promise<GeneratedPrompts> {
  if (!env.GROQ_API_KEY) {
    throw new Error(
      "Groq API key not configured. Please set GROQ_API_KEY environment variable",
    );
  }

  const systemPrompt = `You are an expert at creating ENTERTAINING PRANK CALL scenarios.

Your task is to generate instructions for a PRANK CALL - the PRIMARY GOAL is ENTERTAINMENT.

You must return a JSON object with EXACTLY this structure:
{
  "systemPrompt": "The full instructions for the AI on how to conduct the call...",
  "welcomeGreeting": "The exact opening line the AI should say when the call connects (1-2 sentences max)"
}

The systemPrompt must:
- NEVER mention "AI", "AI-powered", "artificial intelligence", "prank call", or break the fourth wall
- Create a believable, AMUSING scenario designed to get funny, awkward, or hilarious reactions
- Use the interesting piece/hook creatively to set up a clever, entertaining premise
- Incorporate specific details about the target person to make it more effective and personal
- Guide the AI to play a character/situation that will create amusing moments
- Keep responses SHORT (1-3 sentences) - this is a phone call!
- The goal is ENTERTAINMENT - make viewers LAUGH

The welcomeGreeting must:
- Be the EXACT first thing said when they answer (no "Hello?" - jump right into character)
- Set up the scenario immediately
- Be intriguing/confusing enough that they'll respond
- Be 1-2 sentences max
- Stay in character from the very first word

Return ONLY valid JSON, no markdown, no explanation.`;

  const userPrompt = `Generate a prank call scenario JSON for:

**Target Person:**
- Name: ${input.targetPerson.name}
- Gender: ${input.targetPerson.gender}${input.targetPerson.genderCustom ? ` (${input.targetPerson.genderCustom})` : ""}
${input.targetPerson.ageRange ? `- Age Range: ${input.targetPerson.ageRange}` : ""}
${input.targetPerson.city ? `- Lives in: ${input.targetPerson.city}` : ""}
${input.targetPerson.hobby ? `- Hobby: ${input.targetPerson.hobby}` : ""}
${input.targetPerson.profession ? `- Profession: ${input.targetPerson.profession}` : ""}
${input.targetPerson.physicalDescription ? `- Physical Description: ${input.targetPerson.physicalDescription}` : ""}
${input.targetPerson.interestingPiece ? `- Secret/Thing only they know: ${input.targetPerson.interestingPiece}` : ""}
${input.targetPerson.ragebaitTrigger ? `- To ragebait them, say: ${input.targetPerson.ragebaitTrigger}` : ""}

Create an ENTERTAINING scenario. Use the details creatively. Return ONLY the JSON object.`;

  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Groq API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq API returned no content");
  }

  // Log raw response for debugging
  console.log("[Groq] Raw response:", content.substring(0, 500));

  try {
    // Parse the JSON response - handle markdown code blocks
    let jsonContent = content.trim();
    
    // Remove markdown code blocks if present
    if (jsonContent.startsWith("```json")) {
      jsonContent = jsonContent.slice(7);
    } else if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith("```")) {
      jsonContent = jsonContent.slice(0, -3);
    }
    jsonContent = jsonContent.trim();
    
    // Try to find JSON object in the content
    const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }
    
    const parsed = JSON.parse(jsonContent);
    
    if (!parsed.systemPrompt) {
      throw new Error("Missing systemPrompt in response");
    }
    
    console.log("[Groq] ✅ Successfully parsed JSON response");
    return {
      systemPrompt: parsed.systemPrompt,
      welcomeGreeting: parsed.welcomeGreeting || "Hello, is this the person I'm looking for?",
    };
  } catch (error) {
    // Fallback if JSON parsing fails - use the content as system prompt
    console.warn("[Groq] Failed to parse JSON:", error instanceof Error ? error.message : error);
    console.warn("[Groq] Raw content:", content.substring(0, 200));
    return {
      systemPrompt: content.trim(),
      welcomeGreeting: "Hello, is this the person I'm looking for?",
    };
  }
}

/**
 * Generate image prompt using Groq
 * 
 * Layout: 16:9 LANDSCAPE with LEFT = caller (AI), RIGHT = target
 * This is required because WavespeedAI multi model expects LEFT/RIGHT layout.
 * The final video is rotated to 9:16 portrait (LEFT→TOP, RIGHT→BOTTOM) after generation.
 * 
 * If hasUploadedImage is true, we don't describe the RIGHT person's appearance
 * since we have their actual photo - just describe the LEFT caller and style.
 */
export async function generateImagePrompt(
  input: PromptGenerationInput,
): Promise<string> {
  if (!env.GROQ_API_KEY) {
    throw new Error(
      "Groq API key not configured. Please set GROQ_API_KEY environment variable",
    );
  }

  const callerDesc = getRandomCallerDescription();

  // When user uploaded a photo, we only describe the LEFT person (AI caller)
  // The RIGHT will use their uploaded photo as reference
  if (input.hasUploadedImage) {
    const systemPrompt = `You generate concise image prompts for AI image EDITING models.

Generate a prompt to edit an uploaded photo into a HORIZONTAL split-screen phone call scene in ${input.videoStyle} style. Rules:
- 16:9 LANDSCAPE orientation - horizontal split (side by side)
- LEFT HALF: Generate a new AI caller character - describe their appearance
- RIGHT HALF: Will use the UPLOADED REFERENCE PHOTO - DO NOT describe their appearance
- Both characters must be ACTIVELY TALKING ON PHONES with mouths open
- Keep it SHORT and DIRECT - just visual elements
- Apply ${input.videoStyle} art style to the entire image

Format: "Horizontal split-screen ${input.videoStyle} image (16:9 landscape). Left: [caller description with phone, speaking]. Right: Use uploaded reference photo, render in ${input.videoStyle} style, holding phone and speaking. Background: [simple description]."

Return ONLY the prompt text.`;

    const userPrompt = `Edit an uploaded photo into a ${input.videoStyle} phone call scene (16:9 landscape, side by side).

LEFT (caller/AI - GENERATE NEW): ${callerDesc}

RIGHT (target person - USE UPLOADED PHOTO): Render them in ${input.videoStyle} style, holding phone and actively speaking.

Style: ${input.videoStyle}

Write a SHORT prompt. LEFT = generated caller. RIGHT = uploaded photo rendered in the art style. Both must be ACTIVELY TALKING on phones with mouths open.`;

    const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Groq API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Groq API returned no content");
    }

    return content.trim();
  }

  // No uploaded image - describe both characters for text-to-image generation
  // Use 16:9 LANDSCAPE because WavespeedAI multi model expects LEFT/RIGHT layout
  const systemPrompt = `You generate concise image prompts for AI image generation models.

Generate a HORIZONTAL split-screen phone call image prompt in ${input.videoStyle} style. Rules:
- 16:9 LANDSCAPE orientation - horizontal split (side by side), NOT vertical
- ONLY describe what is VISUALLY SEEN - no narrative, no explanations
- TWO characters SIDE BY SIDE, BOTH ACTIVELY TALKING ON PHONES
- LEFT HALF: Caller (AI character) - talking on phone
- RIGHT HALF: Target person (based on provided details) - talking on phone
- IMPORTANT: Characters must be SPEAKING into phones, not just looking at them
- Phone poses: either holding phone TO EAR, or TALKING on speakerphone with phone in hand near mouth
- Show ENGAGED CONVERSATION posture - animated expressions, mouth open/speaking, reactive faces
- Keep it SHORT and DIRECT - just visual elements
- NO phrases like "capturing the essence", "oblivious to", "hint at", "nod to", "exudes"
- NO story/context - just describe appearances, poses, objects, colors, style

Format example: "Horizontal split-screen ${input.videoStyle} image (16:9 landscape). Left: [caller description, phone held to ear, speaking]. Right: [target description, phone held to ear, speaking]. Background: [simple description]."

Return ONLY the prompt text.`;
  
  const userPrompt = `Horizontal split-screen ${input.videoStyle} phone call image (16:9 landscape, side by side).

LEFT (caller/AI): ${callerDesc}

RIGHT (target person): ${input.targetPerson.gender}${input.targetPerson.ageRange ? `, ${input.targetPerson.ageRange}` : ""}${input.targetPerson.physicalDescription ? `, ${input.targetPerson.physicalDescription}` : ""}${input.targetPerson.profession ? `, looks like a ${input.targetPerson.profession}` : ""}${input.targetPerson.hobby ? `, ${input.targetPerson.hobby} enthusiast vibe` : ""}

Style: ${input.videoStyle}

Write a SHORT, VISUAL-ONLY prompt for a HORIZONTAL 16:9 split-screen. LEFT = caller, RIGHT = target. CRITICAL: Both characters must be ACTIVELY TALKING on phones - either phone held to ear OR speakerphone near mouth. Show engaged conversation poses with animated expressions, mouths open/speaking.`;

  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Groq API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq API returned no content");
  }

  return content.trim();
}

