# AI Call TV

AI-powered phone calling system using Twilio + OpenAI.

Built for the zypherpunk hackathon.

## Voice Providers

Two voice providers are available:

| Provider | TTS | STT | Description |
|----------|-----|-----|-------------|
| **ConversationRelay** (default) | ElevenLabs | Deepgram | Simpler, better interruption handling |
| **Media Streams** | OpenAI Realtime | OpenAI Whisper | Lower latency, audio-native |

Set via `VOICE_PROVIDER` env var: `conversation_relay` or `media_streams`

## Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Create `.env` file with your credentials:**
   ```bash
   # URL Configuration (update after getting ngrok URLs - see step 4)
   VITE_BASE_URL="https://your-ngrok-url.ngrok-free.app"
   
   # Voice Provider: conversation_relay (default) or media_streams
   VOICE_PROVIDER=conversation_relay
   
   # WebSocket URL (path depends on provider)
   # ConversationRelay: wss://xxx.ngrok-free.app/conversation-relay
   # Media Streams:     wss://xxx.ngrok-free.app/twilio/stream
   WEBSOCKET_URL="wss://your-ws-ngrok-url.ngrok-free.app/conversation-relay"
   
   # Database
   DATABASE_URL="postgresql://user:pass@your-db.neon.tech/dbname"
   
   # Auth (generate with: bun run auth:secret)
   BETTER_AUTH_SECRET="your-secret"
   
   # Twilio (https://console.twilio.com/)
   TWILIO_ACCOUNT_SID="ACxxxxx"
   TWILIO_AUTH_TOKEN="your-token"
   TWILIO_PHONE_NUMBER="+1234567890"
   
   # OpenAI (https://platform.openai.com/api-keys)
   OPENAI_API_KEY="sk-xxxxx"
   
   # AWS S3 (for audio/video storage)
   AWS_ACCESS_KEY_ID="xxxxx"
   AWS_SECRET_ACCESS_KEY="xxxxx"
   AWS_REGION="us-east-1"
   AWS_S3_BUCKET="your-bucket"
   
   # WavespeedAI (for video generation)
   WAVESPEED_API_KEY="xxxxx"
   
   # Groq (for prompt generation)
   GROQ_API_KEY="xxxxx"
   
   # Resend (for email notifications)
   RESEND_API_KEY="xxxxx"
   ```

3. **Push database schema:**
   ```bash
   bun run db:push
   ```

4. **Twilio Console Setup (one-time for ConversationRelay):**
   - Go to [Twilio Console](https://console.twilio.com/) → Voice → Settings → General
   - Enable **"Predictive and Generative AI/ML Features Addendum"**

## Running the App

You need **3 terminals** open:

### Terminal 1: ngrok (start first!)
```bash
ngrok start --all --config ngrok.yml
```

This will show you **2 forwarding URLs**:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000  (app)
Forwarding  https://xyz789.ngrok-free.app -> http://localhost:3002  (relay)
```

### Update .env with ngrok URLs

Copy the URLs and update your `.env`:
```bash
VITE_BASE_URL="https://abc123.ngrok-free.app"  # port 3000 URL

# For ConversationRelay (default):
WEBSOCKET_URL="wss://xyz789.ngrok-free.app/conversation-relay"

# For Media Streams (if using VOICE_PROVIDER=media_streams):
# WEBSOCKET_URL="wss://xyz789.ngrok-free.app/twilio/stream"
```

**Note:** Change `https://` to `wss://` and add the path!

### Terminal 2: Main App
```bash
bun run dev
```

### Terminal 3: WebSocket Server

**For ConversationRelay (default):**
```bash
bun run dev:ws:relay
```

**For Media Streams:**
```bash
bun run dev:ws
```

### Access the App

**Important:** Open the app via the ngrok URL, not localhost:
```
https://abc123.ngrok-free.app  ✅ Use this
http://localhost:3000          ❌ Don't use this
```

This avoids CORS issues since the auth client is configured to use the ngrok URL.

## Testing a Call

```bash
# Uses current VOICE_PROVIDER setting
bun run test:call

# Explicitly use ConversationRelay
bun run test:call:relay

# Explicitly use Media Streams
bun run test:call:streams
```

Or with a custom number:
```bash
bun scripts/test-call.ts "+1234567890" "John Doe"
```

Watch the logs in Terminal 3 (WebSocket server) to see the call progress.

## Video Generation

The app automatically generates videos from call recordings using **WavespeedAI's `infinitetalk-fast/multi`** model. This creates a dual-person talking avatar video from stereo audio recordings.

### How It Works

1. **Recording**: Twilio records calls as stereo audio (left channel = caller/AI, right channel = target/person)
2. **Processing**: The audio is split into two mono channels and uploaded to S3
3. **Generation**: WavespeedAI generates a multi-person video using:
   - Left audio (caller/AI)
   - Right audio (target/person)
   - Default split-screen image (two people on a phone call, 9:16 portrait)
   - `order: "meanwhile"` mode (shows both people simultaneously)
4. **Storage**: The final video is uploaded to S3 and linked to the call record

### Testing Video Generation

To test the video generation pipeline with an existing call:

```bash
bun run test:video
```

This script:
- Downloads a recording from Twilio
- Splits the stereo audio into caller/target channels
- Generates a multi-person video using WavespeedAI
- Uploads the final video to S3
- Cleans up temporary files

**Note**: Make sure you have:
- `WAVESPEED_API_KEY` set in your `.env`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, and `AWS_S3_BUCKET` configured
- FFmpeg installed (required for audio processing)

### Video Model Details

- **Model**: `infinitetalk-fast/multi` (WavespeedAI)
- **Input**: Left audio, right audio, and a reference image
- **Output**: MP4 video with synchronized lip movements for both speakers
- **Cost**: $0.015 per second of audio

## What Each Terminal Does

1. **ngrok** - Creates 2 public URLs so Twilio can reach your local servers
2. **Main App (port 3000)** - Your web app UI and API (TanStack Start)
3. **WebSocket Server** - Handles Twilio voice calls:
   - **ConversationRelay (port 3002)**: `bun run dev:ws:relay` - Text-based, ElevenLabs TTS + Deepgram STT
   - **Media Streams (port 3001)**: `bun run dev:ws` - Audio-based, OpenAI Realtime API

## Why ngrok?

Twilio needs to make HTTP requests to your server for webhooks and WebSocket connections. Since your computer isn't publicly accessible, ngrok creates temporary public URLs that tunnel to your localhost.

## Production Deployment (Railway)

For production, deploy **2 services** on Railway:

| Service | Description | Environment Variables |
|---------|-------------|----------------------|
| Main App | TanStack Start (port 3000) | `VITE_BASE_URL`, `WEBSOCKET_URL`, all secrets |
| WebSocket | Bun server (port 3001) | `DATABASE_URL`, `OPENAI_API_KEY` |

```bash
# Build command for Main App
bun run build

# Start command for Main App
node .output/server/index.mjs

# Start command for WebSocket
bun run server-ws.ts
```

Set `NODE_ENV=production` and update URLs to your Railway domains.
