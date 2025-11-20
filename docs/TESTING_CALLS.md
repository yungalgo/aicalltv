# Testing Twilio Calls

This guide explains how to test Twilio calls with dual-channel recording and Media Streams.

## Setup

1. Ensure your `.env` file has Twilio credentials:
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=+1...
   VITE_BASE_URL=http://localhost:3000
   ```

2. Make sure your server is running and accessible:
   - For local testing, use a tool like [ngrok](https://ngrok.com/) to expose your local server
   - Update `VITE_BASE_URL` to your ngrok URL (e.g., `https://abc123.ngrok.io`)

## Audio Setup

### Dual-Channel Recording (Post-Call)

Twilio will create a **stereo audio file** (WAV or MP3) where:
- **Left channel** = Caller (person receiving the call)
- **Right channel** = Callee (AI/recipient)

This file is available after the call completes via:
- Twilio Recording API: `https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Recordings/{RecordingSid}`
- Recording Status Webhook: `/api/webhooks/twilio/recording-status`

### Media Streams (Real-Time)

During the call, Twilio sends audio via WebSocket to `/api/twilio/stream`:
- `inbound` track = Caller's audio (real-time)
- `outbound` track = Callee's audio (real-time)

This is used for real-time processing, transcription, etc.

## Testing a Call

### Option 1: Using the Test API Endpoint

```bash
# Make a POST request to the test endpoint
curl -X POST http://localhost:3000/api/test/call \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "phoneNumber": "+1234567890",
    "recipientName": "Test User",
    "recipientContext": "This is a test call to verify dual-channel recording works."
  }'
```

**Test Phone Numbers:**
- Twilio Test Numbers: Use numbers from [Twilio's test credentials](https://www.twilio.com/docs/voice/test-credentials)
- Your own number: Use your verified phone number in Twilio console

### Option 2: Using the UI

1. Navigate to `http://localhost:3000` or `/dashboard`
2. Fill out the call request form
3. Submit the form

## What Happens

1. **Call Initiated**: Call is created in database with status `call_created`
2. **Worker Processes**: pg-boss worker picks up the job
3. **Twilio Call**: Call is initiated via Twilio API with:
   - Media Stream enabled (WebSocket)
   - Dual-channel recording enabled (stereo file)
4. **Media Stream**: Real-time audio flows to `/api/twilio/stream` (if WebSocket handler is set up)
5. **Call Status Updates**: Webhooks update call status at `/api/webhooks/twilio/call-status`
6. **Recording Ready**: When call completes, recording webhook fires at `/api/webhooks/twilio/recording-status`
7. **Recording File**: Download the stereo WAV/MP3 file from Twilio

## Verifying Dual-Channel Recording

After a call completes:

1. Check the recording webhook logs for the `recordingUrl`
2. Download the recording file from Twilio
3. Open in an audio editor (Audacity, etc.)
4. Verify:
   - File is **stereo** (2 channels)
   - **Left channel** has caller's voice
   - **Right channel** has callee's voice

## Example Recording Download

```bash
# Get recording URL from webhook or database
RECORDING_URL="https://api.twilio.com/2010-04-01/Accounts/ACxxx/Recordings/RExxx"

# Download with authentication
curl -X GET "$RECORDING_URL" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  -o recording.wav

# The file will be stereo: left=caller, right=callee
```

## Troubleshooting

- **No recording**: Check that `recordingChannels: "dual"` is set in call creation
- **Webhook not firing**: Ensure your `VITE_BASE_URL` is publicly accessible (use ngrok)
- **Media Stream not connecting**: Check WebSocket endpoint is accessible and handler is implemented

