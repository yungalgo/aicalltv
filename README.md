# AI Call TV

AI-powered phone calling system using Twilio ConversationRelay + OpenAI.

Built for the zypherpunk hackathon.

## Voice Stack

| Component | Provider |
|-----------|----------|
| **Text-to-Speech** | ElevenLabs |
| **Speech-to-Text** | Deepgram |
| **AI Chat** | OpenAI GPT-4o-mini |

## Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Create `.env` file with your credentials:**
   ```bash
   # URL Configuration (update after getting ngrok URLs - see step 4)
   VITE_BASE_URL="https://your-ngrok-url.ngrok-free.app"
   WEBSOCKET_URL="wss://your-ws-ngrok-url.ngrok-free.app/ws"
   
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

4. **Twilio Console Setup (one-time):**
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
Forwarding  https://xyz789.ngrok-free.app -> http://localhost:3001  (ws)
```

### Update .env with ngrok URLs

Copy the URLs and update your `.env`:
```bash
VITE_BASE_URL="https://abc123.ngrok-free.app"  # port 3000 URL
WEBSOCKET_URL="wss://xyz789.ngrok-free.app/ws"  # port 3001 URL (change https to wss, add /ws)
```

### Terminal 2: Main App
```bash
bun run dev
```

### Terminal 3: WebSocket Server
```bash
bun run dev:ws
```

### Access the App

**Important:** Open the app via the ngrok URL, not localhost:
```
https://abc123.ngrok-free.app  ✅ Use this
http://localhost:3000          ❌ Don't use this
```

## Testing a Call

```bash
bun run test:call
```

Or with a custom number:
```bash
bun scripts/test-call.ts "+1234567890" "John Doe"
```

Watch the logs in Terminal 3 (WebSocket server) to see the call progress.

## Video Generation

The app automatically generates videos from call recordings using **WavespeedAI's `infinitetalk-fast/multi`** model.

### How It Works

1. **Recording**: Twilio records calls as stereo audio (left=AI, right=person)
2. **Processing**: Audio is split into two mono channels and uploaded to S3
3. **Generation**: WavespeedAI generates a multi-person video
4. **Storage**: Final video is uploaded to S3 and linked to the call record

### Testing Video Generation

```bash
bun run test:video
```

**Requirements:**
- `WAVESPEED_API_KEY` set in your `.env`
- AWS S3 credentials configured
- FFmpeg installed

## What Each Terminal Does

1. **ngrok** - Creates 2 public URLs so Twilio can reach your local servers
2. **Main App (port 3000)** - Web app UI and API (TanStack Start)
3. **WebSocket (port 3001)** - Handles Twilio ConversationRelay messages

## Production Deployment (Railway)

Deploy **2 services** on Railway:

### Service 1: Main App
| Setting | Value |
|---------|-------|
| Build Command | `bun run build` |
| Start Command | `node .output/server/index.mjs` |
| Port | `3000` |

**Environment Variables:**
```bash
NODE_ENV=production
VITE_BASE_URL=https://your-main-app.railway.app
WEBSOCKET_URL=wss://your-ws-service.railway.app/ws
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
OPENAI_API_KEY=...
GROQ_API_KEY=...
# ... other secrets
```

### Service 2: WebSocket Server
| Setting | Value |
|---------|-------|
| Build Command | (none) |
| Start Command | `bun run server-ws.ts` |
| Port | `3001` |

**Environment Variables:**
```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
OPENAI_API_KEY=...
WS_PORT=3001
```
