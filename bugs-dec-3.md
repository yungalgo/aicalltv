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
**Status:** ✅ FIXED
**Priority:** MEDIUM

**Problem:** Generated images show people holding phones but looking at them (like texting), not talking on them (speakerphone or to ear).

**Fix Applied:** Updated `groq-generator.ts`:
- Characters must be TALKING on phones, not just looking at them
- Phone held to ear OR speakerphone near mouth
- Animated expressions, mouths open/speaking
- Engaged conversation posture

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
**Status:** ✅ FIXED
**Priority:** HIGH

**Problem:** Video URLs expire after ~24 hours (86400 seconds).

**Fix Applied:** Option C - Generate fresh presigned URLs on-demand:
1. Added `videoS3Key` column to store S3 object key
2. Added `getFreshVideoUrl()` function (7 days max expiry)
3. `getUserCalls()` now auto-refreshes expired URLs when fetching
4. `isPresignedUrlExpired()` detects URLs expiring within 1 hour buffer

---

## Progress Tracking

| Bug | Status | Notes |
|-----|--------|-------|
| 1. Call Delay | ✅ | Audio buffering during OpenAI connect |
| 2. Audio Quality | 📋 | Requires better resampling algorithms |
| 3. No Interruption | ✅ | Added server_vad turn detection |
| 4. Image Prompt | ✅ | Updated for active phone conversation pose |
| 5. Form Fill | 📋 | Requires schema migration + UI changes |
| 6. Video Expiry | ✅ | Auto-refresh presigned URLs on-demand |

