# Bug Hunt - December 3, 2025

## 1. Call Connection Delay (5+ seconds)
**Status:** ✅ ROOT CAUSE FOUND
**Priority:** HIGH

**Problem:** When user picks up and says "hello?", AI takes ~5 seconds to start talking.

**Root Causes Found:**
1. **OpenAI connection happens AFTER call connects** (`server-ws.ts:127`)
   - When Twilio sends "start" event, we THEN connect to OpenAI
   - This adds ~1-2 seconds for WebSocket handshake + session init
2. **Database query blocks initialization** (`server-ws.ts:113`)
   - Fetching call data from Postgres adds ~200-500ms
3. **Audio chunks DROPPED while waiting** (`server-ws.ts:160-165`)
   - While OpenAI is connecting, user's "hello?" is discarded
   - Console shows: `"[WS] ⏳ Waiting for OpenAI..."`

**Fix Required:**
- Pre-connect to OpenAI BEFORE call is answered (during "ringing" phase)
- OR: Buffer incoming audio until OpenAI is ready, then send all at once
- Cache call data so DB query isn't in critical path

---

## 2. Poor Audio Quality
**Status:** ✅ ROOT CAUSE FOUND  
**Priority:** HIGH

**Problem:** Call audio sounds like terrible connection quality.

**Root Causes Found:**
1. **Simple resampling algorithms** (`audio-converter.ts`)
   - Linear interpolation for 8kHz→24kHz upsampling (line 144-148)
   - Simple decimation for 24kHz→8kHz downsampling (line 165-166)
   - No anti-aliasing filter - causes artifacts
2. **Telephone audio is inherently 8kHz** (Twilio limitation)
   - Can't get higher quality than what phone network provides
3. **Double conversion** - PCMU→PCM16→PCMU loses fidelity

**Fix Options:**
- Use proper sinc interpolation / Lanczos resampling
- Add low-pass filter before downsampling
- Consider using Twilio's newer codecs if available

---

## 3. AI Doesn't Get Interrupted
**Status:** ✅ ROOT CAUSE FOUND
**Priority:** HIGH

**Problem:** AI talks too long and doesn't stop when user speaks.

**Root Causes Found:**
1. **Missing `turn_detection` in session config** (`openai-client.ts:61-69`)
   ```typescript
   // Current config is MISSING turn_detection:
   const sessionConfig = {
     voice: this.config.voice,
     instructions: this.config.instructions,
     input_audio_format: "pcm16",
     output_audio_format: "pcm16",
     input_audio_transcription: { model: "whisper-1" },
     // MISSING: turn_detection: { type: "server_vad", ... }
   };
   ```
2. **No handling for interruption events**
   - Need to handle `input_audio_buffer.speech_started` 
   - Need to send `response.cancel` when user interrupts

**Fix Required:**
Add to session config:
```typescript
turn_detection: {
  type: "server_vad",
  threshold: 0.5,
  prefix_padding_ms: 300,
  silence_duration_ms: 500,
}
```

---

## 4. Image Prompt - Phone Position
**Status:** 📋 Todo
**Priority:** MEDIUM

**Problem:** Generated images show people holding phones but looking at them (like texting), not talking on them (speakerphone or to ear).

**Fix:** Update image prompt to specify:
- Person holding phone to ear, OR
- Person on speakerphone with phone in hand, talking
- Active conversation pose, not passive phone browsing

---

## 5. Form Fill Improvements + Migration
**Status:** 📋 Todo
**Priority:** MEDIUM

### 5a. Better Data Collection (no image upload)
Current fields to keep:
- ✅ Name
- ✅ Phone number
- ✅ Age
- ✅ Gender

New fields to add:
- [ ] City/area they live in (string)
- [ ] Hobby (string)
- [ ] Profession (string)

Update existing fields:
- [ ] Field 1: "One thing virtually no one/only you know about them"
- [ ] Field 2: "If you wanted to ragebait them, you would say this"

### 5b. Optional Image Upload
- [ ] Add optional image upload field
- [ ] If image provided, use WaveSpeed nano-banana-pro/edit API
- [ ] Composite: uploaded image + phone conversation pose
- [ ] Place target person on correct side (left/right) of split image

**WaveSpeed Edit API:**
```
POST https://api.wavespeed.ai/api/v3/google/nano-banana-pro/edit
```

---

## 6. Video Links Expire (S3 presigned URL)
**Status:** 📋 Todo
**Priority:** HIGH

**Problem:** Video URLs expire after ~24 hours (86400 seconds). Shows XML error:
```xml
<Error>
  <Code>AccessDenied</Code>
  <Message>Request has expired</Message>
  <X-Amz-Expires>86400</X-Amz-Expires>
</Error>
```

**Fix Options:**
- [ ] Option A: Increase presigned URL expiry (7 days? 30 days?)
- [ ] Option B: Store videos in public bucket (if acceptable)
- [ ] Option C: Generate fresh presigned URLs on-demand when viewing
- [ ] Option D: Copy to permanent storage after generation

---

## Progress Tracking

| Bug | Status | Notes |
|-----|--------|-------|
| 1. Call Delay | 🔍 | Need to inspect Twilio/OpenAI handshake |
| 2. Audio Quality | 🔍 | Check codec/sample rate settings |
| 3. No Interruption | 🔍 | Check VAD/turn detection |
| 4. Image Prompt | 📋 | Update prompt text |
| 5. Form Fill | 📋 | Requires migration |
| 6. Video Expiry | 📋 | S3 presigned URL issue |

