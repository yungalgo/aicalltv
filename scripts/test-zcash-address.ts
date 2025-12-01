/**
 * Test script to check ZCash payment QR code generation
 * 
 * Usage: bun run scripts/test-zcash-address.ts
 */

const ZCASH_SERVICE = process.env.ZCASH_SERVICE_URL || "http://localhost:8080";

async function testZcashAddress() {
  console.log("Testing ZCash QR code generation");
  console.log("zcash-service URL:", ZCASH_SERVICE);
  console.log("---");

  // Fetch address from zcash-service
  let address: string;
  try {
    const res = await fetch(`${ZCASH_SERVICE}/address`);
    const data = await res.json();
    
    if (Array.isArray(data) && data[0]?.encoded_address) {
      address = data[0].encoded_address;
    } else {
      throw new Error("Unexpected address format: " + JSON.stringify(data));
    }
    
    console.log("Address from zcash-service:", address);
    console.log("Address length:", address.length);
    console.log("Address prefix:", address.slice(0, 10));
  } catch (err) {
    console.error("Failed to fetch address:", err);
    process.exit(1);
  }
  
  // Generate a sample URI like the payment API does
  const memo = "AICALLTV:ZEC-TEST-123";
  const amount = "0.0010";
  
  const memoBytes = new TextEncoder().encode(memo);
  const base64Memo = btoa(String.fromCharCode(...memoBytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const uri = `zcash:${address}?amount=${amount}&memo=${base64Memo}`;
  
  console.log("---");
  console.log("Amount:", amount, "ZEC");
  console.log("Memo:", memo);
  console.log("Memo (base64url):", base64Memo);
  console.log("---");
  console.log("SAMPLE URI:");
  console.log(uri);
  console.log("---");
  console.log("URI length:", uri.length);
}

testZcashAddress();
