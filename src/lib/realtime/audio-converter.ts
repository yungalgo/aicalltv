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
 */
function decodeMuLaw(pcmuBuffer: Buffer): Buffer {
  const pcm16Buffer = Buffer.alloc(pcmuBuffer.length * 2); // 16-bit = 2 bytes per sample
  
  for (let i = 0; i < pcmuBuffer.length; i++) {
    const mulaw = pcmuBuffer[i];
    
    // ITU-T G.711 μ-law decode
    const sign = (mulaw & 0x80) >> 7;
    const exponent = (mulaw & 0x70) >> 4;
    const mantissa = mulaw & 0x0f;
    
    let sample = ((mantissa << 3) + 132) << (exponent + 3);
    if (sign === 1) {
      sample = -sample;
    }
    
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
  
  for (let i = 0; i < pcmuBuffer.length; i++) {
    const sample = pcm16Buffer.readInt16LE(i * 2);
    
    // ITU-T G.711 μ-law encode
    const sign = sample < 0 ? 0x80 : 0x00;
    let magnitude = Math.abs(sample);
    
    // Add bias
    magnitude += 33;
    magnitude = Math.min(magnitude, 0x7fff);
    
    // Find exponent and mantissa
    let exponent = 7;
    for (let exp = 0; exp < 8; exp++) {
      if (magnitude < (33 << (exp + 3))) {
        exponent = exp;
        break;
      }
    }
    
    const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
    const mulaw = sign | (exponent << 4) | mantissa;
    
    // Invert bits (μ-law standard)
    pcmuBuffer[i] = ~mulaw & 0xff;
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
 * Resample audio from 24kHz to 8kHz (3x downsampling)
 * Simple decimation (take every 3rd sample)
 */
function resample24kTo8k(pcm16Buffer: Buffer): Buffer {
  const inputSamples = pcm16Buffer.length / 2;
  const outputSamples = Math.floor(inputSamples / 3);
  const outputBuffer = Buffer.alloc(outputSamples * 2);
  
  for (let i = 0; i < outputSamples; i++) {
    const sourceIndex = i * 3;
    const sample = pcm16Buffer.readInt16LE(sourceIndex * 2);
    outputBuffer.writeInt16LE(sample, i * 2);
  }
  
  return outputBuffer;
}

