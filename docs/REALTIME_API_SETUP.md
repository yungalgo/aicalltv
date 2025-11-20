# OpenAI Realtime API + Twilio Media Streams Setup

This guide explains how the real-time voice conversation system works.

## Architecture

```
User's Phone ←→ Twilio ←→ Media Stream (WS) ←→ Your Server ←→ OpenAI Realtime API (WS)
```

**Flow:**
1. User receives call from Twilio
2. TwiML starts a Media Stream (WebSocket to your server)
3. Your server connects to OpenAI Realtime API (WebSocket)
4. Audio streams bidirectionally:
   - Caller speaks → Twilio → Server → OpenAI (processes)
   - OpenAI responds → Server → Twilio → Caller hears
5. Conversation happens in real-time with ~300ms latency

## Audio Format Conversions

| Source | Format | Sample Rate |
|--------|--------|-------------|
| Twilio → Server | PCMU (μ-law) | 8 kHz |
| Server → OpenAI | PCM16 (16-bit) | 24 kHz |
| OpenAI → Server | PCM16 (16-bit) | 24 kHz |
| Server → Twilio | PCMU (μ-law) | 8 kHz |

The server handles all audio format conversions automatically.

## Setup

### 1. Add OpenAI API Key

Add to `.env`:
```bash
OPENAI_API_KEY=sk-proj-...
```

Get your API key from: https://platform.openai.com/api-keys

### 2. Enable OpenAI Realtime API

The Realtime API is currently in beta. You need:
- An OpenAI API key with access to `gpt-4o-realtime-preview`
- Sufficient credits (Realtime API costs ~$0.06/minute for audio I/O)

### 3. Test the Setup

Start your dev server and ngrok:
```bash
# Terminal 1
bun run dev

# Terminal 2
ngrok http 3000
```

Update `VITE_BASE_URL` in `.env` with your ngrok URL, then create a test call.

## How It Works

### Call Initiation

1. Worker calls `initiateTwilioCall()` (from `src/lib/twilio/call.ts`)
2. Twilio makes outbound call to recipient
3. When answered, Twilio requests TwiML from `/api/twilio/voice`
4. TwiML starts a Media Stream WebSocket connection

### Media Stream Connection

```typescript
// TwiML tells Twilio to open WebSocket to our server
<Stream url="wss://your-domain.com/api/twilio/_ws/stream">
    <Parameter name="callSid" value="{{CallSid}}" />
</Stream>
```

### WebSocket Handler (`/api/twilio/_ws/stream`)

1. **Connection opened**: Twilio connects WebSocket
2. **"start" event**: 
   - Extract `callSid`
   - Fetch call context from database
   - Connect to OpenAI Realtime API with instructions
3. **"media" events** (continuous):
   - Receive caller audio (PCMU, 8kHz)
   - Convert to PCM16, 24kHz
   - Send to OpenAI
   - Receive OpenAI response (PCM16, 24kHz)
   - Convert to PCMU, 8kHz
   - Send back to Twilio
4. **"stop" event**: Clean up connections

### OpenAI Integration

```typescript
const openaiClient = new OpenAIRealtimeClient({
  apiKey: env.OPENAI_API_KEY,
  voice: "alloy", // or "echo", "shimmer"
  instructions: `You are speaking with ${recipientName}. 
                 Context: ${recipientContext}
                 Have a natural, friendly conversation.`,
});

// Handle audio responses
openaiClient.onAudio((audioBase64) => {
  // Convert and send to Twilio
});
```

## Monitoring

### Server Logs

Watch for these log messages:
- `[Twilio Stream] WebSocket connection opened`
- `[Twilio Stream] Stream started for call: CA123...`
- `[Twilio Stream] OpenAI Realtime connected`
- `[OpenAI Realtime] User said: ...`
- `[OpenAI Realtime] AI responding: ...`

### Twilio Console

https://console.twilio.com/us1/monitor/logs/calls

Check for:
- Call status
- Media Stream connection
- Any error warnings

### OpenAI Dashboard

https://platform.openai.com/usage

Monitor:
- Realtime API usage
- Audio minutes
- Costs

## Dual Recording vs Real-time Stream

We use BOTH:

1. **Real-time Media Stream** (WebSocket):
   - Live conversation with OpenAI
   - Enables natural, low-latency dialogue
   - Used for: Real-time AI interaction

2. **Dual-channel Recording** (Stereo file):
   - Recorded by Twilio separately
   - Stereo: Left=Caller, Right=AI
   - Used for: Post-call video generation
   - Downloaded via `recording-status` webhook

## Customization

### Change AI Voice

In `src/routes/api/twilio/_ws.stream.ts`:
```typescript
const openaiClient = new OpenAIRealtimeClient({
  voice: "echo", // Options: "alloy", "echo", "shimmer"
  // ...
});
```

### Change Instructions/Personality

Modify the `instructions` field to customize AI behavior:
```typescript
instructions: `You are a friendly assistant calling ${recipientName}.
Your goal is to have a brief, friendly conversation.
Keep responses under 20 seconds.
Context: ${recipientContext}`
```

### Adjust Audio Quality

Edit `src/lib/realtime/audio-converter.ts` to use better resampling algorithms.

## Troubleshooting

### "OPENAI_API_KEY not configured"
- Add `OPENAI_API_KEY` to `.env`
- Restart dev server

### WebSocket not connecting
- Ensure ngrok is running
- Check `VITE_BASE_URL` is set to ngrok HTTPS URL
- Verify Vite's `allowedHosts` includes ngrok domain

### Poor audio quality
- Check audio conversion in `audio-converter.ts`
- Consider using a proper audio resampling library (e.g., `@samplerate/node-libsamplerate`)

### High latency
- OpenAI Realtime typically has 300-500ms latency
- Ensure server has good network connection
- Consider using a server closer to OpenAI's infrastructure

## Cost Estimation

OpenAI Realtime API pricing (as of Dec 2024):
- Audio input: $0.06/minute
- Audio output: $0.24/minute
- Text input/output: Standard GPT-4 pricing

Example 5-minute call:
- Input: 5 min × $0.06 = $0.30
- Output: 5 min × $0.24 = $1.20
- **Total: ~$1.50 per 5-minute call**

Plus Twilio costs:
- Outbound call: ~$0.013/minute
- Recording: $0.0025/minute
- Media Stream: No additional cost

**Total: ~$1.52 per 5-minute call**

