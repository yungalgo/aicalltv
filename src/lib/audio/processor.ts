/**
 * Audio processing utilities
 * Handles conversion from Twilio PCMU format to formats needed for video generation
 */

import type { ProcessedAudioData } from "~/lib/twilio/stream-example";

/**
 * Process Twilio Media Stream audio chunks
 * Converts PCMU (μ-law) to WAV format for video generation
 * 
 * @param streamMessages - Array of Twilio stream messages
 * @returns Processed audio data with separate tracks and mixed audio
 */
export async function processTwilioStream(
  streamMessages: Array<{
    event: string;
    media?: {
      track: "inbound" | "outbound";
      payload: string;
      timestamp: string;
    };
  }>,
): Promise<ProcessedAudioData> {
  // Separate inbound and outbound audio chunks
  const inboundChunks: Buffer[] = [];
  const outboundChunks: Buffer[] = [];
  let startTime: Date | null = null;
  let endTime: Date | null = null;

  for (const message of streamMessages) {
    if (message.event === "media" && message.media) {
      const audioChunk = Buffer.from(message.media.payload, "base64");
      const timestamp = new Date(message.media.timestamp);

      if (!startTime) startTime = timestamp;
      endTime = timestamp;

      if (message.media.track === "inbound") {
        inboundChunks.push(audioChunk);
      } else if (message.media.track === "outbound") {
        outboundChunks.push(audioChunk);
      }
    }
  }

  // Convert PCMU to WAV format
  // TODO: Use a library like 'pcmu' or 'alawmulaw' to decode PCMU
  // For now, we'll create a placeholder that will be replaced with actual conversion
  const inboundAudio = await convertPCMUToWAV(Buffer.concat(inboundChunks));
  const outboundAudio = await convertPCMUToWAV(Buffer.concat(outboundChunks));
  
  // Mix audio tracks for video generation
  // TODO: Implement proper mixing when both tracks are available
  const mixedAudio = await mixAudioTracks(inboundAudio);

  const duration = startTime && endTime
    ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
    : 0;

  return {
    callSid: "", // Will be set by caller
    inboundAudio,
    outboundAudio,
    mixedAudio,
    duration,
    sampleRate: 8000, // PCMU is typically 8kHz
  };
}

/**
 * Convert PCMU (μ-law) audio to WAV format
 * TODO: Implement actual PCMU decoding using a library
 */
async function convertPCMUToWAV(pcmuData: Buffer): Promise<Buffer> {
  // TODO: Use a library like:
  // - 'pcmu' npm package
  // - 'alawmulaw' npm package
  // - Or implement μ-law decoding algorithm
  
  // Placeholder: Return as-is for now (will need proper conversion)
  // In production, decode PCMU to linear PCM, then wrap in WAV header
  return pcmuData;
}

/**
 * Mix two audio tracks together
 * TODO: Implement audio mixing logic
 */
async function mixAudioTracks(track1: Buffer): Promise<Buffer> {
  // TODO: Implement audio mixing
  // - Decode both tracks to linear PCM
  // - Mix samples together (average or sum with normalization)
  // - Encode back to WAV format
  
  // Placeholder: Return first track for now
  return track1;
}

