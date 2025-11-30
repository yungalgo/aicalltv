/**
 * Test script to check ZCash payment QR code generation
 * 
 * Usage: bun run scripts/test-zcash-address.ts
 */

// Fixed YWallet receiving address
const ZCASH_RECEIVING_ADDRESS = "u1t9jazuuepq6asej3danuvnewgvqvtgpmg3686m4825gkknttm3d94sla8t9daa70tgr35u7w5xp2m90gglu4qtt7nyzjznk873vgrpcsl33wz2amau3p96g5vjmlxtezhc06jhqqyth3ghdd45n9x4ekeqkszz3hv2mez52v452krsne";

function testZcashAddress() {
  console.log("Testing ZCash QR code generation with FIXED address");
  console.log("---");

  // Use the fixed YWallet address
  const address = ZCASH_RECEIVING_ADDRESS;
  
  console.log("FIXED ADDRESS:", address);
  console.log("Address length:", address.length);
  console.log("Address prefix:", address.slice(0, 10));
  
  // Generate a sample URI like the payment API does
  const memo = "AICALLTV:ZEC-TEST-123";
  const amount = "0.0010"; // Updated to match new price
  
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
