/**
 * Audio format conversion utilities
 * Converts between Twilio's PCMU (μ-law, 8kHz) and OpenAI's PCM16 (16-bit PCM, 24kHz)
 */

/**
 * Convert PCMU (μ-law) to PCM16
 * Twilio sends PCMU at 8kHz, OpenAI expects PCM16 at 24kHz
 * 
 * @param pcmuBase64 - Base64 encoded PCMU audio from Twilio
 * @returns Base64 encoded PCM16 audio for OpenAI (resampled to 24kHz)
 */
export function pcmuToPCM16(pcmuBase64: string): string {
  // Decode base64 to buffer
  const pcmuBuffer = Buffer.from(pcmuBase64, "base64");
  
  // Decode μ-law to linear PCM (16-bit)
  const pcm16Buffer = decodeMuLaw(pcmuBuffer);
  
  // Resample from 8kHz to 24kHz
  const resampled = resample8kTo24k(pcm16Buffer);
  
  // Encode to base64
  return resampled.toString("base64");
}

/**
 * Convert PCM16 to PCMU (μ-law)
 * OpenAI sends PCM16 at 24kHz, Twilio expects PCMU at 8kHz
 * 
 * @param pcm16Base64 - Base64 encoded PCM16 audio from OpenAI
 * @returns Base64 encoded PCMU audio for Twilio (downsampled to 8kHz)
 */
export function pcm16ToPCMU(pcm16Base64: string): string {
  // Decode base64 to buffer
  const pcm16Buffer = Buffer.from(pcm16Base64, "base64");
  
  // Resample from 24kHz to 8kHz
  const downsampled = resample24kTo8k(pcm16Buffer);
  
  // Encode to μ-law
  const pcmuBuffer = encodeMuLaw(downsampled);
  
  // Encode to base64
  return pcmuBuffer.toString("base64");
}

/**
 * Decode μ-law (PCMU) to linear PCM (16-bit)
 * Based on ITU-T G.711 standard
 * Reference: https://en.wikipedia.org/wiki/G.711
 */
function decodeMuLaw(pcmuBuffer: Buffer): Buffer {
  const pcm16Buffer = Buffer.alloc(pcmuBuffer.length * 2); // 16-bit = 2 bytes per sample
  
  // μ-law decode constants
  const MULAW_BIAS = 33;
  // Note: MULAW_MAX (0x1FFF) not used but kept for reference
  
  for (let i = 0; i < pcmuBuffer.length; i++) {
    let mulaw = pcmuBuffer[i];
    
    // Invert bits (μ-law standard)
    mulaw = ~mulaw & 0xff;
    
    // Extract sign, exponent, and mantissa
    const sign = (mulaw & 0x80) ? -1 : 1;
    const exponent = (mulaw & 0x70) >> 4;
    const mantissa = mulaw & 0x0f;
    
    // Decode to linear PCM
    let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
    sample = sample - MULAW_BIAS;
    
    // Apply sign and clamp to 16-bit range
    sample = sign * sample;
    sample = Math.max(-32768, Math.min(32767, sample));
    
    // Write as 16-bit little-endian
    pcm16Buffer.writeInt16LE(sample, i * 2);
  }
  
  return pcm16Buffer;
}

/**
 * Encode linear PCM (16-bit) to μ-law (PCMU)
 * Based on ITU-T G.711 standard
 */
function encodeMuLaw(pcm16Buffer: Buffer): Buffer {
  const pcmuBuffer = Buffer.alloc(pcm16Buffer.length / 2);
  const MULAW_BIAS = 33;
  
  for (let i = 0; i < pcmuBuffer.length; i++) {
    const sample = pcm16Buffer.readInt16LE(i * 2);
    
    // Get sign and magnitude
    const sign = sample < 0 ? 0x80 : 0x00;
    let magnitude = Math.abs(sample);
    
    // Add bias
    magnitude += MULAW_BIAS;
    magnitude = Math.min(magnitude, 0x7FFF);
    
    // Find exponent (segment)
    let exponent = 7;
    for (let exp = 0; exp < 8; exp++) {
      if (magnitude < (MULAW_BIAS << (exp + 3))) {
        exponent = exp;
        break;
      }
    }
    
    // Extract mantissa
    const mantissa = (magnitude >> (exponent + 3)) & 0x0F;
    
    // Combine to create μ-law byte
    let mulaw = sign | (exponent << 4) | mantissa;
    
    // Invert bits (μ-law uses inverted encoding)
    mulaw = ~mulaw & 0xFF;
    
    pcmuBuffer[i] = mulaw;
  }
  
  return pcmuBuffer;
}

/**
 * Resample audio from 8kHz to 24kHz (3x upsampling)
 * Simple linear interpolation
 */
function resample8kTo24k(pcm16Buffer: Buffer): Buffer {
  const inputSamples = pcm16Buffer.length / 2;
  const outputSamples = inputSamples * 3; // 3x upsampling
  const outputBuffer = Buffer.alloc(outputSamples * 2);
  
  for (let i = 0; i < outputSamples; i++) {
    const sourceIndex = i / 3;
    const sourceIndexFloor = Math.floor(sourceIndex);
    const sourceIndexCeil = Math.min(sourceIndexFloor + 1, inputSamples - 1);
    const fraction = sourceIndex - sourceIndexFloor;
    
    // Linear interpolation
    const sample1 = pcm16Buffer.readInt16LE(sourceIndexFloor * 2);
    const sample2 = pcm16Buffer.readInt16LE(sourceIndexCeil * 2);
    const interpolated = Math.round(sample1 + (sample2 - sample1) * fraction);
    
    outputBuffer.writeInt16LE(interpolated, i * 2);
  }
  
  return outputBuffer;
}

/**
 * Simple low-pass filter coefficients for anti-aliasing
 * This is a 7-tap FIR filter designed to attenuate frequencies above ~3.5kHz
 * when running at 24kHz sample rate (to prevent aliasing when downsampling to 8kHz)
 * 
 * Coefficients approximate a sinc function windowed with Hamming
 */
const LOW_PASS_COEFFICIENTS = [
  0.05, 0.1, 0.2, 0.3, 0.2, 0.1, 0.05
];

/**
 * Apply low-pass filter to prevent aliasing before downsampling
 */
function applyLowPassFilter(pcm16Buffer: Buffer): Buffer {
  const inputSamples = pcm16Buffer.length / 2;
  const outputBuffer = Buffer.alloc(pcm16Buffer.length);
  const halfKernel = Math.floor(LOW_PASS_COEFFICIENTS.length / 2);
  
  for (let i = 0; i < inputSamples; i++) {
    let sum = 0;
    
    for (let j = 0; j < LOW_PASS_COEFFICIENTS.length; j++) {
      const sampleIndex = i + j - halfKernel;
      // Clamp to valid range
      const clampedIndex = Math.max(0, Math.min(inputSamples - 1, sampleIndex));
      const sample = pcm16Buffer.readInt16LE(clampedIndex * 2);
      sum += sample * LOW_PASS_COEFFICIENTS[j];
    }
    
    // Clamp result to 16-bit range
    const filtered = Math.max(-32768, Math.min(32767, Math.round(sum)));
    outputBuffer.writeInt16LE(filtered, i * 2);
  }
  
  return outputBuffer;
}

/**
 * Resample audio from 24kHz to 8kHz (3x downsampling)
 * Applies low-pass anti-aliasing filter before decimation to prevent artifacts
 */
function resample24kTo8k(pcm16Buffer: Buffer): Buffer {
  // Apply low-pass filter first to prevent aliasing (removes frequencies > 4kHz)
  const filtered = applyLowPassFilter(pcm16Buffer);
  
  const inputSamples = filtered.length / 2;
  const outputSamples = Math.floor(inputSamples / 3);
  const outputBuffer = Buffer.alloc(outputSamples * 2);
  
  for (let i = 0; i < outputSamples; i++) {
    const sourceIndex = i * 3;
    const sample = filtered.readInt16LE(sourceIndex * 2);
    outputBuffer.writeInt16LE(sample, i * 2);
  }
  
  return outputBuffer;
}

