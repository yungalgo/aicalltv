/**
 * Twilio ConversationRelay WebSocket Message Types
 * 
 * These are the messages exchanged between your app and ConversationRelay
 */

// ============================================
// Messages FROM Twilio ConversationRelay
// ============================================

/**
 * Setup message - sent when WebSocket connection is established
 */
export interface SetupMessage {
  type: "setup";
  sessionId: string;
  callSid: string;
  parentCallSid?: string;
  from: string;
  to: string;
  forwardedFrom?: string;
  callerName?: string;
  direction: "inbound" | "outbound";
  callType: string;
  callStatus: string;
  accountSid: string;
  applicationSid?: string;
  customParameters: Record<string, string>;
}

/**
 * Prompt message - contains transcribed user speech
 */
export interface PromptMessage {
  type: "prompt";
  voicePrompt: string;
  confidence?: number;
  lang?: string;
  last?: boolean;
}

/**
 * Interrupt message - user interrupted the AI
 * utteranceUntilInterrupt tells you what was heard before interruption
 */
export interface InterruptMessage {
  type: "interrupt";
  utteranceUntilInterrupt: string;
  durationUntilInterruptMs?: number;
}

/**
 * DTMF message - user pressed a key
 */
export interface DTMFMessage {
  type: "dtmf";
  digit: string;
}

/**
 * Error message from ConversationRelay
 */
export interface ErrorMessage {
  type: "error";
  description: string;
  errorCode?: string;
}

/**
 * Debug messages (when debug attribute is set)
 */
export interface DebugMessage {
  type: "debug" | "info";
  message: string;
}

/**
 * Speaker event messages (when debug includes "speaker-events")
 */
export interface SpeakerEventMessage {
  type: "agentSpeaking" | "clientSpeaking";
}

/**
 * Token played message (when debug includes "tokens-played")
 */
export interface TokenPlayedMessage {
  type: "tokens-played";
  tokens: string;
}

export type IncomingRelayMessage = 
  | SetupMessage 
  | PromptMessage 
  | InterruptMessage 
  | DTMFMessage 
  | ErrorMessage 
  | DebugMessage
  | SpeakerEventMessage
  | TokenPlayedMessage;

// ============================================
// Messages TO Twilio ConversationRelay
// ============================================

/**
 * Text token message - send text to be spoken
 * Set last: false to stream tokens, last: true when done
 */
export interface TextTokenMessage {
  type: "text";
  token: string;
  last: boolean;
  lang?: string; // Optional language override for TTS
}

/**
 * Clear message - clear any pending/buffered audio
 */
export interface ClearMessage {
  type: "clear";
}

/**
 * End message - end the ConversationRelay session
 */
export interface EndMessage {
  type: "end";
  handoffData?: string; // Optional JSON string with handoff info
}

/**
 * Switch language message - change STT/TTS language
 */
export interface SwitchLanguageMessage {
  type: "language";
  ttsLanguage?: string;
  transcriptionLanguage?: string;
}

export type OutgoingRelayMessage = 
  | TextTokenMessage 
  | ClearMessage 
  | EndMessage 
  | SwitchLanguageMessage;

// ============================================
// Session State
// ============================================

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  wasInterrupted?: boolean;
  interruptedAt?: string; // Content up to interruption point
}

export interface ConversationSession {
  sessionId: string;
  callSid: string;
  openaiPrompt: string;
  conversation: ConversationTurn[];
  isProcessing: boolean;
  lastAssistantResponse?: string;
}

