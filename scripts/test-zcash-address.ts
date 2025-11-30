/**
 * Test script to check what the zcash-service returns for addresses
 * 
 * Usage: bun run scripts/test-zcash-address.ts
 */

const ZCASH_SERVICE_URL = process.env.ZCASH_SERVICE_URL || "http://localhost:8080";

async function testZcashAddress() {
  console.log("Testing ZCash service at:", ZCASH_SERVICE_URL);
  console.log("---");

  try {
    // Test /health endpoint first
    console.log("1. Testing /health...");
    const healthRes = await fetch(`${ZCASH_SERVICE_URL}/health`);
    if (healthRes.ok) {
      const health = await healthRes.json();
      console.log("   Health:", JSON.stringify(health, null, 2));
    } else {
      console.log("   Health check failed:", healthRes.status, healthRes.statusText);
    }
  } catch (err) {
    console.log("   Health check error:", err instanceof Error ? err.message : err);
  }

  console.log("---");

  try {
    // Test /address endpoint
    console.log("2. Testing /address...");
    const addressRes = await fetch(`${ZCASH_SERVICE_URL}/address`);
    
    if (!addressRes.ok) {
      console.log("   Address request failed:", addressRes.status, addressRes.statusText);
      const text = await addressRes.text();
      console.log("   Response body:", text);
      return;
    }

    let addresses = await addressRes.json();
    
    console.log("   Raw response type:", typeof addresses);
    console.log("   Is array:", Array.isArray(addresses));
    
    // zingo-cli outputs log messages along with JSON - need to extract the JSON
    if (typeof addresses === 'string') {
      console.log("   Raw string (first 200 chars):", addresses.slice(0, 200));
      // Try to find JSON array or object in the string
      const jsonMatch = addresses.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          addresses = JSON.parse(jsonMatch[0]);
          console.log("   Extracted JSON from string!");
        } catch (e) {
          console.log("   Failed to parse extracted JSON:", e);
        }
      }
    }
    
    console.log("   Parsed response:", JSON.stringify(addresses, null, 2));
    
    // Try to extract address using the same logic as payment.ts
    let extractedAddress: string | undefined;
    
    if (typeof addresses === 'string') {
      extractedAddress = addresses;
      console.log("   Format: Simple string (no JSON found)");
    } else if (Array.isArray(addresses)) {
      const first = addresses[0];
      console.log("   First element type:", typeof first);
      console.log("   First element:", JSON.stringify(first, null, 2));
      
      if (typeof first === 'string') {
        extractedAddress = first;
        console.log("   Format: Array of strings");
      } else if (first && typeof first === 'object') {
        // zingo-cli uses encoded_address
        extractedAddress = first.encoded_address || first.address || first.ua || first.z_address;
        console.log("   Format: Array of objects");
        console.log("   Available keys:", Object.keys(first));
      }
    } else if (typeof addresses === 'object') {
      console.log("   Available keys:", Object.keys(addresses));
      extractedAddress = addresses.encoded_address || addresses.ua || addresses.unified_address || addresses.z_address || addresses.address;
      console.log("   Format: Object with keys");
    }

    console.log("---");
    console.log("EXTRACTED ADDRESS:", extractedAddress);
    console.log("Address type:", typeof extractedAddress);
    console.log("Address length:", extractedAddress?.length);
    console.log("Address prefix:", extractedAddress?.slice(0, 10));
    
    if (extractedAddress && typeof extractedAddress === 'string') {
      // Generate a sample URI like the payment API does
      const memo = "AICALLTV:ZEC-TEST-123";
      const memoBytes = new TextEncoder().encode(memo);
      const base64Memo = btoa(String.fromCharCode(...memoBytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      const uri = `zcash:${extractedAddress}?amount=0.0100&memo=${base64Memo}`;
      
      console.log("---");
      console.log("SAMPLE URI:");
      console.log(uri);
      console.log("---");
      console.log("URI length:", uri.length);
    } else {
      console.log("---");
      console.log("ERROR: Could not extract a valid address!");
    }

  } catch (err) {
    console.log("   Address request error:", err instanceof Error ? err.message : err);
  }
}

testZcashAddress();

