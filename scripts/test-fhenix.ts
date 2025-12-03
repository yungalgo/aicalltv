/**
 * Test script for Fhenix CoFHE encryption
 * Run with: bun run scripts/test-fhenix.ts
 */

// Import from node environment
import { cofhejs, Encryptable } from "cofhejs/node";

async function testEncryption() {
  console.log("🔐 Testing Fhenix CoFHE encryption...\n");

  try {
    // Check what's available in the cofhejs module
    console.log("Available exports from cofhejs:");
    console.log("- cofhejs:", typeof cofhejs);
    console.log("- Encryptable:", typeof Encryptable);
    
    // Log the cofhejs object methods
    console.log("\ncofhejs methods:");
    if (cofhejs) {
      console.log(Object.keys(cofhejs));
    }

    console.log("\nEncryptable methods:");
    if (Encryptable) {
      console.log(Object.keys(Encryptable));
    }

    console.log("\n✅ Module loaded successfully!");
    console.log("\nNote: Full encryption requires initialization with provider/signer.");
    console.log("This test confirms the module is properly installed.");

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testEncryption();

