# Starting the Development Servers

You need to run 3 terminals for full functionality:

## Terminal 1: Main App Server

```bash
cd /Users/yungalgo/Desktop/repos/aicalltv
bun run dev
```

This runs the main app on `http://localhost:3000`

## Terminal 2: WebSocket Server

```bash
cd /Users/yungalgo/Desktop/repos/aicalltv
bun run dev:ws
```

This runs the WebSocket server for Twilio Media Streams on `http://localhost:3001`

You should see:
```
🚀 WebSocket server running on http://localhost:3001
📡 Twilio should connect to: ws://localhost:3001/twilio/stream
```

## Terminal 3: ngrok for Main App

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

Update `.env`:
```bash
VITE_BASE_URL=https://abc123.ngrok-free.app
```

## Terminal 4: ngrok for WebSocket Server

```bash
ngrok http 3001
```

Copy the HTTPS URL and update `.env`:
```bash
WEBSOCKET_URL=wss://xyz789.ngrok-free.app/twilio/stream
```

**Important:** Replace `https://` with `wss://` for the WebSocket URL!

## After Updating .env

Restart Terminal 1 and Terminal 2 so they pick up the new URLs.

## Testing

```bash
bun scripts/test-call.ts
```

Watch Terminal 2 for WebSocket logs:
```
[Twilio Stream] ✅ WebSocket connection OPENED
[Twilio Stream] 🚀 Stream STARTED
[Twilio Stream] 🔌 Connecting to OpenAI...
[Twilio Stream] ✅ OpenAI connected
[OpenAI Realtime] User said: ...
```

## Why Separate Servers?

TanStack Start + Nitro v3 alpha doesn't fully support WebSocket routes yet.
The standalone WebSocket server is a clean workaround that:
- Works reliably with Bun's native WebSocket support
- Can be easily monitored/debugged
- Will be merged back when TanStack Start adds proper WS support

