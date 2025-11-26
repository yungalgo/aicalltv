/**
 * OpenAI Realtime API WebSocket Client
 * Handles bidirectional audio streaming with OpenAI's Realtime API
 * 
 * Docs: https://platform.openai.com/docs/guides/realtime
 */

import WebSocket from "ws";
import { env } from "~/env/server";

export interface OpenAIRealtimeConfig {
  apiKey: string;
  model?: string;
  voice?: "alloy" | "echo" | "shimmer";
  instructions?: string;
}

export interface AudioChunk {
  audio: string; // Base64 encoded PCM16 audio
  timestamp: number;
}

export class OpenAIRealtimeClient {
  private ws: WebSocket | null = null;
  private config: OpenAIRealtimeConfig;
  private onAudioCallback?: (audio: string) => void;
  private onTranscriptCallback?: (text: string) => void;
  private onErrorCallback?: (error: Error) => void;
  private firstAudioSentTime?: number;
  private firstAudioReceivedLogged = false;

  constructor(config: OpenAIRealtimeConfig) {
    this.config = {
      model: "gpt-4o-realtime-preview-2024-12-17",
      voice: "alloy",
      ...config,
    };
  }

  /**
   * Connect to OpenAI Realtime API
   */
  async connect(): Promise<void> {
    const url = "wss://api.openai.com/v1/realtime?model=" + this.config.model;
    
    console.log("[OpenAI Realtime] Connecting to:", url);
    console.log("[OpenAI Realtime] API Key present:", !!this.config.apiKey);
    console.log("[OpenAI Realtime] API Key length:", this.config.apiKey?.length || 0);

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, {
        headers: {
          "Authorization": `Bearer ${this.config.apiKey}`,
          "OpenAI-Beta": "realtime=v1",
        },
      });

      this.ws.on("open", () => {
        console.log("[OpenAI Realtime] ✅ WebSocket connection OPENED");
        
        // Send session configuration
        const sessionConfig = {
          voice: this.config.voice,
          instructions: this.config.instructions,
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          input_audio_transcription: {
            model: "whisper-1",
          },
        };
        
        console.log("[OpenAI Realtime] Sending session config:", JSON.stringify(sessionConfig, null, 2));
        this.sendSessionUpdate(sessionConfig);

        resolve();
      });

      this.ws.on("message", (data: Buffer) => {
        this.handleMessage(data);
      });

      this.ws.on("error", (error) => {
        console.error("[OpenAI Realtime] ❌ WebSocket ERROR:", error);
        console.error("[OpenAI Realtime] Error details:", JSON.stringify(error, null, 2));
        if (this.onErrorCallback) {
          this.onErrorCallback(error);
        }
        reject(error);
      });

      this.ws.on("close", (code, reason) => {
        console.log("[OpenAI Realtime] ❌ Connection CLOSED");
        console.log("[OpenAI Realtime] Close code:", code);
        console.log("[OpenAI Realtime] Close reason:", reason.toString());
      });
    });
  }

  /**
   * Send session configuration
   */
  private sendSessionUpdate(config: any) {
    this.send({
      type: "session.update",
      session: config,
    });
  }

  /**
   * Send audio chunk to OpenAI
   * @param audio - Base64 encoded PCM16 audio (24kHz, 16-bit, mono)
   */
  sendAudio(audio: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[OpenAI Realtime] Cannot send audio - connection not open");
      return;
    }

    // Track when first audio was sent
    if (!this.firstAudioSentTime) {
      this.firstAudioSentTime = Date.now();
      console.log("[OpenAI Realtime] ⏱️  First audio sent to OpenAI");
    }

    this.send({
      type: "input_audio_buffer.append",
      audio,
    });
  }

  /**
   * Commit audio buffer (signals end of user speech)
   */
  commitAudio() {
    this.send({
      type: "input_audio_buffer.commit",
    });
  }

  /**
   * Send generic message
   */
  private send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Handle incoming messages from OpenAI
   */
  private handleMessage(data: Buffer) {
    try {
      const message = JSON.parse(data.toString());
      
      // Log all messages for debugging
      console.log("[OpenAI Realtime] 📥 Received message:", message.type);
      if (message.type !== "response.audio.delta") {
        // Don't log every audio chunk, too noisy
        console.log("[OpenAI Realtime] Message data:", JSON.stringify(message, null, 2));
      }

      switch (message.type) {
        case "response.audio.delta":
          // Audio response chunk from OpenAI
          if (!this.firstAudioReceivedLogged) {
            this.firstAudioReceivedLogged = true;
            const responseTime = this.firstAudioSentTime ? Date.now() - this.firstAudioSentTime : 0;
            console.log(`[OpenAI Realtime] ⏱️  First audio RECEIVED from OpenAI (${responseTime}ms after first send)`);
          }
          if (this.onAudioCallback && message.delta) {
            this.onAudioCallback(message.delta);
          }
          break;

        case "conversation.item.input_audio_transcription.completed":
          // User speech transcript
          if (this.onTranscriptCallback && message.transcript) {
            console.log("[OpenAI Realtime] User said:", message.transcript);
            this.onTranscriptCallback(message.transcript);
          }
          break;

        case "response.audio_transcript.delta":
          // AI response transcript
          if (message.delta) {
            console.log("[OpenAI Realtime] AI responding:", message.delta);
          }
          break;

        case "error":
          console.error("[OpenAI Realtime] Error:", message.error);
          if (this.onErrorCallback) {
            this.onErrorCallback(new Error(message.error.message));
          }
          break;

        default:
          // Log other events for debugging
          console.log("[OpenAI Realtime] Event:", message.type);
      }
    } catch (error) {
      console.error("[OpenAI Realtime] Failed to parse message:", error);
    }
  }

  /**
   * Register callback for audio responses
   */
  onAudio(callback: (audio: string) => void) {
    this.onAudioCallback = callback;
  }

  /**
   * Register callback for transcripts
   */
  onTranscript(callback: (text: string) => void) {
    this.onTranscriptCallback = callback;
  }

  /**
   * Register callback for errors
   */
  onError(callback: (error: Error) => void) {
    this.onErrorCallback = callback;
  }

  /**
   * Close connection
   */
  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

