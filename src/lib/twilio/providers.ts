/**
 * Twilio Voice Provider Configuration
 * 
 * Two providers available:
 * 1. MEDIA_STREAMS - Raw audio via WebSocket + OpenAI Realtime API
 *    - Lower latency for audio
 *    - OpenAI's native voice capabilities
 *    - More complex (audio conversion required)
 * 
 * 2. CONVERSATION_RELAY - Text-based via ConversationRelay + ElevenLabs TTS
 *    - Built-in interruption handling with utteranceUntilInterrupt
 *    - ElevenLabs TTS (high quality voices)
 *    - Deepgram STT (high accuracy)
 *    - Simpler architecture (just text)
 */

export type VoiceProvider = "media_streams" | "conversation_relay";

/**
 * Get the current voice provider
 * Can be set via VOICE_PROVIDER env var or defaults to conversation_relay
 */
export function getVoiceProvider(): VoiceProvider {
  const provider = process.env.VOICE_PROVIDER?.toLowerCase();
  
  if (provider === "media_streams" || provider === "mediastreams") {
    return "media_streams";
  }
  
  // Default to conversation_relay (newer, better interruption handling)
  return "conversation_relay";
}

/**
 * Get the TwiML endpoint URL for the current provider
 */
export function getTwiMLEndpoint(baseUrl: string): string {
  const provider = getVoiceProvider();
  
  if (provider === "media_streams") {
    return `${baseUrl}/api/twilio/voice`;
  }
  
  return `${baseUrl}/api/twilio/voice-relay`;
}

/**
 * Get the WebSocket URL for the current provider
 */
export function getWebSocketUrl(wsBaseUrl: string): string {
  const provider = getVoiceProvider();
  
  if (provider === "media_streams") {
    return `${wsBaseUrl}/twilio/stream`;
  }
  
  return `${wsBaseUrl}/conversation-relay`;
}

/**
 * Get the WebSocket server port for the current provider
 */
export function getWebSocketPort(): number {
  const provider = getVoiceProvider();
  
  if (provider === "media_streams") {
    return parseInt(process.env.PORT || "3001");
  }
  
  return parseInt(process.env.RELAY_PORT || "3002");
}

/**
 * Provider info for logging/debugging
 */
export function getProviderInfo(): {
  provider: VoiceProvider;
  description: string;
  tts: string;
  stt: string;
} {
  const provider = getVoiceProvider();
  
  if (provider === "media_streams") {
    return {
      provider,
      description: "Raw audio via WebSocket + OpenAI Realtime API",
      tts: "OpenAI Realtime",
      stt: "OpenAI Realtime (Whisper)",
    };
  }
  
  return {
    provider,
    description: "Text-based via ConversationRelay",
    tts: "ElevenLabs",
    stt: "Deepgram (nova-3-general)",
  };
}

