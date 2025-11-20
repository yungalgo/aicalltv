# AI Call TV

AI-powered phone calling system using Twilio + OpenAI Realtime API.

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
   
   FAL_KEY="xxxxx"
   
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

## ngrok Setup (First Time)

If you haven't used ngrok before:

1. **Install:**
   ```bash
   brew install ngrok
   ```

2. **Get auth token:**
   - Go to https://dashboard.ngrok.com/get-started/your-authtoken
   - Copy your token

3. **Configure:**
   ```bash
   ngrok config add-authtoken YOUR_TOKEN
   ```

Now you can use the `ngrok http` commands above.

## Troubleshooting

**"Got HTTP 404 response" from Twilio?**
- ngrok URLs expire when you restart ngrok
- Get new URLs from terminals 3 & 4
- Update `.env` with new URLs
- Restart terminals 1 & 2 (env vars don't hot reload)

**"ngrok authentication failed"?**
- Get new token: https://dashboard.ngrok.com/get-started/your-authtoken
- Run: `ngrok config add-authtoken YOUR_TOKEN`

**"Database connection failed"?**
- Check your `DATABASE_URL` in `.env`

## What Each Terminal Does

1. **Main App (port 3000)** - Your web app UI and API
2. **WebSocket Server (port 3001)** - Handles Twilio call audio
3. **ngrok** - Creates 2 public URLs so Twilio can reach your local servers from the internet

## Why ngrok?

Twilio needs to make HTTP requests to your server for webhooks and WebSocket connections. Since your computer isn't publicly accessible, ngrok creates temporary public URLs that tunnel to your localhost.
