# Twilio Media Stream Example

This document shows the structure of audio stream data we receive from Twilio during a call.

## Stream Message Format

Twilio sends WebSocket messages with the following structure:

### 1. Connection Established
```json
{
  "event": "connected",
  "streamSid": "MZ1234567890abcdef"
}
```

### 2. Stream Started (with metadata)
```json
{
  "event": "start",
  "streamSid": "MZ1234567890abcdef",
  "start": {
    "accountSid": "AC1234567890abcdef",
    "callSid": "CA1234567890abcdef",
    "tracks": {
      "inbound": {
        "track": "inbound",
        "codec": "PCMU",
        "rtp": {
          "payloadType": 0,
          "ssrc": 1234567890
        }
      },
      "outbound": {
        "track": "outbound",
        "codec": "PCMU",
        "rtp": {
          "payloadType": 0,
          "ssrc": 9876543210
        }
      }
    }
  }
}
```

### 3. Audio Chunks (repeated throughout call)

**Inbound (Caller's audio):**
```json
{
  "event": "media",
  "streamSid": "MZ1234567890abcdef",
  "media": {
    "track": "inbound",
    "chunk": "1",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "payload": "gD8A..." // Base64 encoded PCMU audio data
  }
}
```

**Outbound (AI's audio):**
```json
{
  "event": "media",
  "streamSid": "MZ1234567890abcdef",
  "media": {
    "track": "outbound",
    "chunk": "2",
    "timestamp": "2024-01-01T12:00:00.020Z",
    "payload": "gD8B..." // Base64 encoded PCMU audio data
  }
}
```

### 4. Stream Stopped
```json
{
  "event": "stop",
  "streamSid": "MZ1234567890abcdef",
  "stop": {
    "accountSid": "AC1234567890abcdef",
    "callSid": "CA1234567890abcdef"
  }
}
```

## Processing Flow

1. **Receive Stream**: WebSocket receives messages
2. **Separate Tracks**: Split inbound (caller) and outbound (AI) audio
3. **Decode PCMU**: Convert μ-law encoded audio to linear PCM
4. **Mix Audio**: Combine both tracks for video generation
5. **Convert to WAV**: Wrap in WAV format for video generation API
6. **Generate Video**: Send to fal.ai or similar service
7. **Upload to S3**: Store final video
8. **Update Database**: Mark call as complete with video URL

## Audio Format Details

- **Codec**: PCMU (μ-law)
- **Sample Rate**: 8000 Hz
- **Channels**: Mono (separate tracks for inbound/outbound)
- **Encoding**: Base64 in WebSocket messages
- **Chunk Size**: ~20ms per chunk (160 bytes at 8kHz)

## Mock Data

See `src/lib/twilio/stream-example.ts` for a complete mock example you can use for testing without making actual calls.

