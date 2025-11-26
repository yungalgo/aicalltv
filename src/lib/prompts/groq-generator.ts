/**
 * Groq API integration for generating dynamic prompts
 * Uses meta-llama/llama-4-scout-17b-16e-instruct model
 */

import { env } from "~/env/server";

const GROQ_API_BASE = "https://api.groq.com/openai/v1";
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export interface TargetPersonData {
  name: string;
  gender: "male" | "female" | "prefer_not_to_say" | "other";
  genderCustom?: string; // If gender is "other"
  ageRange?: string; // "18-25", "26-35", "36-45", "46-55", "56+"
  physicalDescription?: string;
  interestingPiece?: string; // Personal details/hook
}

export interface PromptGenerationInput {
  targetPerson: TargetPersonData;
  videoStyle: string; // Aesthetic style: "anime", "claymation", "puppets", etc.
  anythingElse?: string; // Optional additional context
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
${input.targetPerson.physicalDescription ? `- Physical Description: ${input.targetPerson.physicalDescription}` : ""}
${input.targetPerson.interestingPiece ? `- Interesting Hook/Personal Detail: ${input.targetPerson.interestingPiece}` : ""}
${input.anythingElse ? `\n**Additional Context:** ${input.anythingElse}` : ""}

**CRITICAL REQUIREMENTS:**
- Create an AMUSING, ENTERTAINING scenario that will result in funny, awkward, or hilarious reactions
- Use the interesting piece/hook creatively to set up a clever, amusing premise
- The goal is ENTERTAINMENT - make viewers laugh at ${input.targetPerson.name}'s reactions
- Create a believable character/situation that will catch them off guard
- Incorporate the context in a way that creates an entertaining scenario
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

  const systemPrompt = `You are an expert at creating detailed image generation prompts for video call scenes.

Your task is to generate a prompt for creating a split-screen video call image in the specified aesthetic style. The prompt should:
- Describe two people in a split-screen phone call format
- Match the aesthetic style requested (${input.videoStyle})
- Include details about the target person based on the provided information (gender, age, physical description)
- Be visually descriptive and match the style aesthetic
- Create an engaging visual that would work well for a talking avatar video
- Be detailed enough to generate a high-quality image

Return ONLY the prompt text as a string - do not wrap it in JSON or add any formatting.`;

  const userPrompt = `Generate an image prompt for a split-screen video call scene:

**Target Person:**
- Name: ${input.targetPerson.name}
- Gender: ${input.targetPerson.gender}${input.targetPerson.genderCustom ? ` (${input.targetPerson.genderCustom})` : ""}
${input.targetPerson.ageRange ? `- Age Range: ${input.targetPerson.ageRange}` : ""}
${input.targetPerson.physicalDescription ? `- Physical Description: ${input.targetPerson.physicalDescription}` : ""}

**Video Aesthetic Style:** ${input.videoStyle}
${input.anythingElse ? `\n**Additional Context:** ${input.anythingElse}` : ""}

Generate a detailed visual prompt that describes a split-screen phone call scene in ${input.videoStyle} style, featuring ${input.targetPerson.name}${input.targetPerson.physicalDescription ? ` (${input.targetPerson.physicalDescription})` : ""}. Return ONLY the prompt text.`;

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

