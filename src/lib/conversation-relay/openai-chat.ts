/**
 * OpenAI Chat Completion Client for ConversationRelay
 * 
 * Uses streaming to send tokens as they arrive for lower latency
 * Works with ConversationRelay's text-based interface
 */

import OpenAI from "openai";
import type { ConversationTurn } from "./types";

export interface ChatConfig {
  apiKey: string;
  model?: string;
  systemPrompt: string;
}

export class OpenAIChatClient {
  private client: OpenAI;
  private model: string;
  private systemPrompt: string;

  constructor(config: ChatConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || "gpt-4o-mini";
    this.systemPrompt = config.systemPrompt;
  }

  /**
   * Stream a response from OpenAI
   * Calls onToken for each token, returns full response when done
   */
  async streamResponse(
    conversation: ConversationTurn[],
    onToken: (token: string) => void,
  ): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: this.systemPrompt },
      ...conversation.map((turn) => ({
        role: turn.role as "user" | "assistant",
        content: turn.content,
      })),
    ];

    console.log("[OpenAI Chat] Streaming response...");
    console.log("[OpenAI Chat] Messages:", messages.length);

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      stream: true,
      max_tokens: 1024,
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        onToken(content);
      }
    }

    console.log("[OpenAI Chat] Response complete:", fullResponse.length, "chars");
    return fullResponse;
  }

  /**
   * Update the system prompt (e.g., with call-specific context)
   */
  setSystemPrompt(prompt: string) {
    this.systemPrompt = prompt;
  }
}

