# Twilio + OpenAI Realtime API Integration

Complete implementation of real-time AI voice calls using Twilio Media Streams and OpenAI Realtime API.

## 🎯 What's Implemented

### ✅ Twilio Integration
- **Call Initiation** (`src/lib/twilio/call.ts`)
  - Outbound calls with dual-channel recording
  - Media Stream WebSocket setup
  - Status and recording webhooks

- **TwiML Endpoint** (`src/routes/api/twilio/voice.ts`)
  - Returns TwiML that starts Media Stream
  - Configures WebSocket connection parameters

- **Webhooks** (`src/routes/api/webhooks/twilio/`)
  - `call-status.ts` - Handles call lifecycle events
  - `recording-status.ts` - Processes dual-channel recordings

### ✅ OpenAI Realtime API
- **Client** (`src/lib/realtime/openai-client.ts`)
  - WebSocket connection to OpenAI
  - Session configuration
  - Bidirectional audio streaming
  - Transcript handling

- **Audio Conversion** (`src/lib/realtime/audio-converter.ts`)
  - PCMU (μ-law) ↔ PCM16 conversion
  - 8kHz ↔ 24kHz resampling
  - Format bridging between Twilio and OpenAI

- **WebSocket Bridge** (`src/routes/api/twilio/_ws.stream.ts`)
  - Receives Twilio Media Stream
  - Proxies audio to/from OpenAI
  - Real-time format conversion

### ✅ Call Queue System (pg-boss)
- **Job Queue** (`src/lib/queue/boss.ts`)
  - Async job processing
  - Scheduled job execution
  - Queue management

- **Call Processor Worker** (`src/lib/workers/call-processor.ts`)
  - TCPA compliance checks (max 3 calls/day per number)
  - Calling hours validation (9 AM - 9 PM local time)
  - Automatic retry scheduling
  - Call initiation

- **Video Generator Worker** (`src/lib/workers/video-generator.ts`)
  - Processes dual-channel recordings
  - Generates video from audio
  - S3 upload (placeholder)

### ✅ Call Retry Logic
- **Retry Logic** (`src/lib/calls/retry-logic.ts`)
  - TCPA-compliant retry scheduling
  - Timezone-aware calling hours
  - Daily call limit tracking
  - Smart time slot selection (10 AM, 2 PM, 6 PM)

### ✅ Testing & Documentation
- Test endpoints (`src/routes/api/test/`)
- Testing scripts (`scripts/`, `test-call.sh`)
- Comprehensive docs (`docs/TESTING_CALLS.md`, `docs/REALTIME_API_SETUP.md`)

## 🔄 Complete Call Flow

### 1. User Creates Call
```
User submits form → createCall() → DB record created → pg-boss job enqueued
```

### 2. Job Processing
```
Worker picks up job → Checks TCPA & calling hours → Initiates Twilio call
```

### 3. Call Connects
```
Twilio calls recipient → Answers → Requests TwiML → Starts Media Stream
```

### 4. Real-time Conversation
```
Caller speaks → Twilio (PCMU 8kHz) → Server converts → OpenAI (PCM16 24kHz)
OpenAI responds → Server converts → Twilio plays → Caller hears
```

### 5. Call Ends
```
Call completes → Webhook fires → Dual-channel recording available → Video job enqueued
```

### 6. Video Generation
```
Worker downloads recording → Generates video → Uploads to S3 → DB updated
```

## 📊 Data Flow

### Database Schema
- `calls` table tracks:
  - Call metadata (recipient, context)
  - Twilio tracking (`callSid`, `recordingUrl`, `duration`)
  - Retry state (`attempts`, `nextRetryAt`, `daysSinceFirstAttempt`)
  - Video status (`videoUrl`, `videoStatus`, `falJobId`)

### pg-boss Queues
- `process-call` - Handles call initiation and retries
- `generate-video` - Processes recordings into videos

## 🔧 Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# App
VITE_BASE_URL=https://your-ngrok-url.ngrok-free.app

# Auth
BETTER_AUTH_SECRET=...

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# OpenAI
OPENAI_API_KEY=sk-proj-...
```

### Optional Configuration

In `src/lib/realtime/openai-client.ts`:
- Change voice: `"alloy"`, `"echo"`, or `"shimmer"`
- Adjust instructions for AI personality
- Configure transcription settings

In `src/lib/calls/retry-logic.ts`:
- Adjust calling hours (default: 9 AM - 9 PM)
- Change retry time slots (default: 10 AM, 2 PM, 6 PM)
- Modify max retry days (default: 5 days)

## 🚀 Deployment Checklist

- [ ] Set `VITE_BASE_URL` to production domain
- [ ] Configure Twilio webhooks in Twilio Console
- [ ] Set `OPENAI_API_KEY` in production environment
- [ ] Push database schema (`bun run db push`)
- [ ] Ensure WebSocket connections work through load balancer/proxy
- [ ] Set up monitoring for worker jobs
- [ ] Configure S3 bucket for video storage (currently placeholder)

## 📝 Next Steps / TODOs

### Audio Processing
- [ ] Implement better resampling (use `@samplerate/node-libsamplerate`)
- [ ] Add noise reduction/filtering
- [ ] Implement proper audio mixing for dual-channel recordings

### OpenAI Integration
- [ ] Add conversation context persistence
- [ ] Implement function calling for actions (transfer, hang up, etc.)
- [ ] Add sentiment analysis from transcripts
- [ ] Store conversation transcripts in database

### Video Generation
- [ ] Integrate with fal.ai or similar service
- [ ] Download and process dual-channel recordings
- [ ] Generate video with AI avatar
- [ ] Upload to S3
- [ ] Generate shareable URLs

### Encryption
- [ ] Implement Fhenix CoFHE for phone number encryption
- [ ] Secure PII data at rest
- [ ] Key management

### Monitoring & Analytics
- [ ] Track call success rates
- [ ] Monitor OpenAI API costs
- [ ] Alert on failed calls
- [ ] Dashboard for call analytics

## 🔗 Key Files

| File | Purpose |
|------|---------|
| `src/lib/twilio/call.ts` | Initiate calls |
| `src/lib/realtime/openai-client.ts` | OpenAI WebSocket client |
| `src/lib/realtime/audio-converter.ts` | Audio format conversion |
| `src/routes/api/twilio/_ws.stream.ts` | WebSocket bridge handler |
| `src/routes/api/twilio/voice.ts` | TwiML endpoint |
| `src/lib/workers/call-processor.ts` | Async call processing |
| `src/lib/calls/retry-logic.ts` | TCPA-compliant retry logic |

## 💰 Cost Breakdown

Per 5-minute call:
- **OpenAI Realtime**: ~$1.50
  - Input audio: $0.30
  - Output audio: $1.20
- **Twilio**: ~$0.08
  - Outbound call: $0.065
  - Recording: $0.0125
  - Media Stream: Free
- **Total: ~$1.58 per 5-minute call**

## 🐛 Debugging

### Enable verbose logging

Add to worker files:
```typescript
console.log("[Debug] Audio chunk:", audioData);
```

### Test without calling

Use mock data from `src/lib/twilio/stream-example.ts`:
```typescript
import { MOCK_STREAM_MESSAGES } from "~/lib/twilio/stream-example";
```

### Monitor WebSockets

Use ngrok's web interface: `http://127.0.0.1:4040`
- See all WebSocket connections
- Inspect messages
- Replay requests

## 📚 References

- [Twilio Media Streams](https://www.twilio.com/docs/voice/media-streams)
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [pg-boss Documentation](https://github.com/timgit/pg-boss)
- [TCPA Compliance](https://www.fcc.gov/general/telemarketing-and-robocalls)

