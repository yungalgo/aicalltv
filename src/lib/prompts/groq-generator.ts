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
}

/**
 * Generate OpenAI call prompt using Groq
 */
export async function generateOpenAIPrompt(
  input: PromptGenerationInput,
): Promise<string> {
  if (!env.GROQ_API_KEY) {
    throw new Error(
      "Groq API key not configured. Please set GROQ_API_KEY environment variable",
    );
  }

  const systemPrompt = `You are an expert at creating ENTERTAINING PRANK CALL scenarios.

Your task is to generate instructions for a PRANK CALL - the PRIMARY GOAL is ENTERTAINMENT. The instructions must:
- NEVER mention "AI", "AI-powered", "artificial intelligence", "prank call", or break the fourth wall
- Create a believable, AMUSING scenario designed to get funny, awkward, or hilarious reactions
- Use the interesting piece/hook creatively to set up a clever, entertaining premise
- Incorporate specific details about the target person to make it more effective and personal
- Guide the AI to play a character/situation that will create amusing moments
- The conversation should be ENTERTAINING - aim for funny reactions, confusion, awkward situations, or hilarious misunderstandings
- Make it catchy and clever - use the hook to create an amusing scenario that catches them off guard
- The AI should stay in character and create interactions that viewers will find funny
- Guide the AI on how to open, what character to play, and how to escalate for maximum entertainment value
- Examples: mistaken identity scenarios, absurd situations, clever wordplay, awkward misunderstandings, ridiculous premises
- The goal is to make viewers LAUGH - create situations that will result in entertaining reactions

Return ONLY the prompt text as a string - do not wrap it in JSON or add any formatting.`;

  const userPrompt = `Generate instructions for an ENTERTAINING PRANK CALL scenario:

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

**CRITICAL REQUIREMENTS:**
- Create an AMUSING, ENTERTAINING scenario that will result in funny, awkward, or hilarious reactions
- Use ALL the personal details creatively - city, hobby, profession, secrets, ragebait triggers
- The goal is ENTERTAINMENT - make viewers laugh at ${input.targetPerson.name}'s reactions
- Create a believable character/situation that will catch them off guard
- If a ragebait trigger is provided, work it naturally into the conversation for maximum effect
- Guide the AI on what character to play, how to open, and how to create amusing moments
- Examples: mistaken identity, absurd situations, clever misunderstandings, awkward scenarios
- NEVER mention AI, prank calls, or break character
- The conversation should be entertaining and result in funny reactions
- Make it catchy, clever, and designed to create amusing interactions

Generate the prompt now. Return ONLY the prompt text.`;

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
      temperature: 0.8, // Slightly higher for more creative/entertaining prompts
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

/**
 * Generate image prompt using Groq
 */
export async function generateImagePrompt(
  input: PromptGenerationInput,
): Promise<string> {
  if (!env.GROQ_API_KEY) {
    throw new Error(
      "Groq API key not configured. Please set GROQ_API_KEY environment variable",
    );
  }

  const systemPrompt = `You generate concise image prompts for AI image generation models.

Generate a VERTICAL split-screen phone call image prompt in ${input.videoStyle} style. Rules:
- 9:16 PORTRAIT orientation - vertical split, NOT horizontal
- ONLY describe what is VISUALLY SEEN - no narrative, no explanations
- TWO characters stacked VERTICALLY, BOTH ACTIVELY TALKING ON PHONES
- TOP HALF: Caller (AI character) - talking on phone
- BOTTOM HALF: Target person (based on provided details) - talking on phone
- IMPORTANT: Characters must be SPEAKING into phones, not just looking at them
- Phone poses: either holding phone TO EAR, or TALKING on speakerphone with phone in hand near mouth
- Show ENGAGED CONVERSATION posture - animated expressions, mouth open/speaking, reactive faces
- Keep it SHORT and DIRECT - just visual elements
- NO phrases like "capturing the essence", "oblivious to", "hint at", "nod to", "exudes"
- NO story/context - just describe appearances, poses, objects, colors, style

Format example: "Vertical split-screen ${input.videoStyle} image (9:16 portrait). Top: [caller description, phone held to ear, speaking]. Bottom: [target description, phone held to ear, speaking]. Background: [simple description]."

Return ONLY the prompt text.`;

  const callerDesc = getRandomCallerDescription();
  
  const userPrompt = `Vertical split-screen ${input.videoStyle} phone call image (9:16 portrait).

TOP (caller/AI): ${callerDesc}

BOTTOM (target person): ${input.targetPerson.gender}${input.targetPerson.ageRange ? `, ${input.targetPerson.ageRange}` : ""}${input.targetPerson.physicalDescription ? `, ${input.targetPerson.physicalDescription}` : ""}${input.targetPerson.profession ? `, looks like a ${input.targetPerson.profession}` : ""}${input.targetPerson.hobby ? `, ${input.targetPerson.hobby} enthusiast vibe` : ""}

Style: ${input.videoStyle}

Write a SHORT, VISUAL-ONLY prompt for a VERTICAL 9:16 split-screen. TOP = caller, BOTTOM = target. CRITICAL: Both characters must be ACTIVELY TALKING on phones - either phone held to ear OR speakerphone near mouth. Show engaged conversation poses with animated expressions, mouths open/speaking.`;

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

