/**
 * Mock example of Twilio Media Stream WebSocket messages
 * This represents what we'll receive during a call
 * 
 * Twilio sends WebSocket messages with the following structure:
 * - "connected" event when stream starts
 * - "start" event with stream metadata
 * - "media" events with audio chunks (base64 encoded PCMU/μ-law)
 * - "stop" event when stream ends
 */

export interface TwilioStreamMessage {
  event: "connected" | "start" | "media" | "stop";
  streamSid?: string;
  start?: {
    accountSid: string;
    callSid: string;
    tracks: {
      inbound: {
        track: "inbound";
        codec: "PCMU";
        rtp: {
          payloadType: number;
          ssrc: number;
        };
      };
      outbound: {
        track: "outbound";
        codec: "PCMU";
        rtp: {
          payloadType: number;
          ssrc: number;
        };
      };
    };
  };
  media?: {
    track: "inbound" | "outbound"; // "inbound" = caller, "outbound" = AI/recipient
    chunk: string; // Base64 encoded PCMU audio data
    timestamp: string; // ISO timestamp
    payload: string; // Base64 encoded audio chunk
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
}

/**
 * Example stream messages sequence
 */
export const MOCK_STREAM_MESSAGES: TwilioStreamMessage[] = [
  // 1. Connection established
  {
    event: "connected",
    streamSid: "MZ1234567890abcdef",
  },
  
  // 2. Stream started with metadata
  {
    event: "start",
    streamSid: "MZ1234567890abcdef",
    start: {
      accountSid: "AC1234567890abcdef",
      callSid: "CA1234567890abcdef",
      tracks: {
        inbound: {
          track: "inbound",
          codec: "PCMU",
          rtp: {
            payloadType: 0,
            ssrc: 1234567890,
          },
        },
        outbound: {
          track: "outbound",
          codec: "PCMU",
          rtp: {
            payloadType: 0,
            ssrc: 9876543210,
          },
        },
      },
    },
  },
  
  // 3. Audio chunks from caller (inbound)
  {
    event: "media",
    streamSid: "MZ1234567890abcdef",
    media: {
      track: "inbound",
      chunk: "1",
      timestamp: "2024-01-01T12:00:00.000Z",
      payload: "gD8A", // Base64 encoded PCMU audio chunk (example)
    },
  },
  
  // 4. Audio chunks from AI (outbound)
  {
    event: "media",
    streamSid: "MZ1234567890abcdef",
    media: {
      track: "outbound",
      chunk: "2",
      timestamp: "2024-01-01T12:00:00.020Z",
      payload: "gD8B", // Base64 encoded PCMU audio chunk (example)
    },
  },
  
  // 5. More audio chunks (continues throughout call)
  {
    event: "media",
    streamSid: "MZ1234567890abcdef",
    media: {
      track: "inbound",
      chunk: "3",
      timestamp: "2024-01-01T12:00:00.040Z",
      payload: "gD8C",
    },
  },
  
  // 6. Stream stopped
  {
    event: "stop",
    streamSid: "MZ1234567890abcdef",
    stop: {
      accountSid: "AC1234567890abcdef",
      callSid: "CA1234567890abcdef",
    },
  },
];

/**
 * Processed audio data structure
 * After processing the stream, we'll have:
 */
export interface ProcessedAudioData {
  callSid: string;
  inboundAudio: Buffer; // Caller's audio (PCMU decoded to WAV)
  outboundAudio: Buffer; // AI's audio (PCMU decoded to WAV)
  mixedAudio: Buffer; // Combined audio for video generation
  duration: number; // Duration in seconds
  sampleRate: number; // Audio sample rate (typically 8000 Hz for PCMU)
}

/**
 * Example processed audio data (mock)
 */
export const MOCK_PROCESSED_AUDIO: ProcessedAudioData = {
  callSid: "CA1234567890abcdef",
  inboundAudio: Buffer.from("mock inbound audio data"),
  outboundAudio: Buffer.from("mock outbound audio data"),
  mixedAudio: Buffer.from("mock mixed audio data"),
  duration: 120, // 2 minutes
  sampleRate: 8000,
};

