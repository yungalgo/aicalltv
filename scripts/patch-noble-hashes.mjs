/**
 * Patch @noble/hashes to add missing ./crypto export
 * This is needed because some versions of @noble/hashes don't export ./crypto
 * but thirdweb's dependencies try to import it.
 */

import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Content for the crypto shim
const cryptoShimContent = `// Auto-generated shim for @noble/hashes/crypto
export const crypto = typeof globalThis === "object" && "crypto" in globalThis
  ? globalThis.crypto
  : undefined;
`;

// Find all @noble/hashes installations and patch them
function patchNobleHashes(basePath) {
  const nobleHashesPath = join(basePath, "@noble", "hashes");

  if (!existsSync(nobleHashesPath)) {
    return false;
  }

  // Create crypto.js for CJS
  const cryptoCjsPath = join(nobleHashesPath, "crypto.js");
  if (!existsSync(cryptoCjsPath)) {
    console.log(`[patch] Creating ${cryptoCjsPath}`);
    writeFileSync(
      cryptoCjsPath,
      `// Auto-generated shim for @noble/hashes/crypto
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crypto = typeof globalThis === "object" && "crypto" in globalThis
  ? globalThis.crypto
  : undefined;
`
    );
  }

  // Create esm/crypto.js for ESM
  const esmDir = join(nobleHashesPath, "esm");
  if (existsSync(esmDir)) {
    const cryptoEsmPath = join(esmDir, "crypto.js");
    if (!existsSync(cryptoEsmPath)) {
      console.log(`[patch] Creating ${cryptoEsmPath}`);
      writeFileSync(cryptoEsmPath, cryptoShimContent);
    }
  }

  return true;
}

// Paths to check for @noble/hashes
const pathsToCheck = [
  join(projectRoot, "node_modules"),
  // Check nested node_modules from thirdweb dependencies
  join(projectRoot, "node_modules", "thirdweb", "node_modules"),
  join(projectRoot, "node_modules", "ox", "node_modules"),
  join(projectRoot, "node_modules", "@walletconnect", "utils", "node_modules"),
  join(
    projectRoot,
    "node_modules",
    "@walletconnect",
    "utils",
    "node_modules",
    "viem",
    "node_modules"
  ),
];

console.log("[patch] Patching @noble/hashes for crypto export...");

let patched = false;
for (const basePath of pathsToCheck) {
  if (patchNobleHashes(basePath)) {
    patched = true;
  }
}

if (patched) {
  console.log("[patch] Successfully patched @noble/hashes");
} else {
  console.log("[patch] No @noble/hashes installations found to patch");
}

