# AI Call TV

AI-powered phone calling system using Twilio + OpenAI Realtime API.

Built for the zypherpunk hackathon.

## Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Create `.env` file with your credentials:**
   ```bash
   DATABASE_URL="postgresql://user:pass@your-db.neon.tech/dbname"
   BETTER_AUTH_SECRET="generate-with: bun run auth:secret"
   
   TWILIO_ACCOUNT_SID="ACxxxxx"
   TWILIO_AUTH_TOKEN="your-token"
   TWILIO_PHONE_NUMBER="+1234567890"
   
   OPENAI_API_KEY="sk-xxxxx"
   
   AWS_ACCESS_KEY_ID="xxxxx"
   AWS_SECRET_ACCESS_KEY="xxxxx"
   AWS_REGION="us-east-1"
   AWS_S3_BUCKET="your-bucket"
   
   WAVESPEED_API_KEY="xxxxx"
   
   # Add these after getting ngrok URLs (see step 4)
   VITE_BASE_URL="https://your-ngrok-url.ngrok-free.app"
   WEBSOCKET_URL="wss://your-ngrok-url.ngrok-free.app/twilio/stream"
   ```

3. **Push database schema:**
   ```bash
   bun run db push
   ```

## Running the App

You need **3 terminals** open:

### Terminal 1: Main App
```bash
bun run dev
```

### Terminal 2: WebSocket Server
```bash
bun run dev:ws
```

### Terminal 3: ngrok (both tunnels at once)
```bash
ngrok start --all --config ngrok.yml
```

This will show you **2 URLs**:
- One for port 3000 (main app)
- One for port 3001 (websocket)

Copy both `https://` URLs

### Update .env with ngrok URLs

Add these to your `.env` file:
```bash
VITE_BASE_URL="https://abc123.ngrok-free.app"
WEBSOCKET_URL="wss://xyz789.ngrok-free.app/twilio/stream"
```
**Note:** Change `https://` to `wss://` for WEBSOCKET_URL!

**Then restart terminals 1 & 2** (Ctrl+C and start them again)
*Environment variables only load at startup, so you need to restart for new URLs*

## Testing a Call

In a **new terminal** (or reuse one of the above):

```bash
bun scripts/test-call.ts
```

Or with a custom number:
```bash
bun scripts/test-call.ts "+1234567890" "John Doe" "This is a test call"
```

Watch the logs in Terminal 2 to see the call progress.

## Video Generation

The app automatically generates videos from call recordings using **WavespeedAI's `infinitetalk-fast/multi`** model. This creates a dual-person talking avatar video from stereo audio recordings.

### How It Works

1. **Recording**: Twilio records calls as stereo audio (left channel = caller, right channel = callee)
2. **Processing**: The audio is split into two mono channels and uploaded to S3
3. **Generation**: WavespeedAI generates a multi-person video using:
   - Left audio (caller)
   - Right audio (callee)
   - Default split-screen image (two people on a park bench)
   - `order: "meanwhile"` mode (shows both people simultaneously)
4. **Storage**: The final video is uploaded to S3 and linked to the call record

### Testing Video Generation

To test the video generation pipeline with an existing call:

```bash
bun run test:video
```

This script:
- Downloads a recording from Twilio
- Splits the stereo audio into caller/callee channels
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

1. **Main App (port 3000)** - Your web app UI and API
2. **WebSocket Server (port 3001)** - Handles Twilio call audio
3. **ngrok** - Creates 2 public URLs so Twilio can reach your local servers from the internet

## Why ngrok?

Twilio needs to make HTTP requests to your server for webhooks and WebSocket connections. Since your computer isn't publicly accessible, ngrok creates temporary public URLs that tunnel to your localhost.
