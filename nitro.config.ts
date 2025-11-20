// Nitro configuration for WebSocket handlers
// https://nitro.unjs.io/config
import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  experimental: {
    websocket: true,
  },
});

