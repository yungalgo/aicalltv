/**
 * Cache call data in WebSocket server to avoid DB queries in critical path
 * 
 * When a call is initiated, we cache the OpenAI prompt in the WebSocket server's
 * in-memory cache. This allows handleStart() to get the prompt instantly when
 * the call connects, avoiding a 200-500ms database query delay.
 */

import { env } from "~/env/server";

/**
 * Cache call data in WebSocket server
 * @param callSid - Twilio Call SID
 * @param openaiPrompt - OpenAI prompt for the call
 */
export async function cacheCallData(
  callSid: string,
  openaiPrompt: string,
): Promise<void> {
  try {
    // Convert WebSocket URL to HTTP URL for cache endpoint
    // wss://host/path -> https://host/cache/call
    // ws://host/path -> http://host/cache/call
    let cacheUrl: string;
    if (env.WEBSOCKET_URL) {
      const wsUrl = env.WEBSOCKET_URL;
      if (wsUrl.startsWith("wss://")) {
        cacheUrl = wsUrl.replace("wss://", "https://").replace("/twilio/stream", "") + "/cache/call";
      } else if (wsUrl.startsWith("ws://")) {
        cacheUrl = wsUrl.replace("ws://", "http://").replace("/twilio/stream", "") + "/cache/call";
      } else {
        cacheUrl = wsUrl.replace("/twilio/stream", "") + "/cache/call";
      }
    } else {
      // Fallback to localhost
      cacheUrl = "http://localhost:3001/cache/call";
    }
    
    const response = await fetch(cacheUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callSid,
        openaiPrompt,
      }),
    });
    
    if (response.ok) {
      console.log(`[Call Cache] ✅ Cached call data for ${callSid}`);
    } else {
      const errorText = await response.text().catch(() => "Unknown error");
      console.warn(`[Call Cache] ⚠️ Failed to cache call data: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    // Non-critical - cache failure shouldn't block call
    console.warn(`[Call Cache] ⚠️ Error caching call data (non-critical):`, error);
  }
}

