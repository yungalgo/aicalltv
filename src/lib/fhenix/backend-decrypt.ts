/**
 * Backend Fhenix Decryption Service
 * 
 * Handles server-side decryption of phone numbers stored in the PIIVault contract.
 * The backend service address must be set as an allowed decryptor in the contract.
 * 
 * Contract: 0x7eD75e4ec7b3Df1b651654d7A7E89CeC0AcEf0a5 (Base Mainnet)
 * 
 * NOTE: This is a placeholder implementation for the hackathon.
 * Full implementation requires:
 * 1. Backend wallet private key stored securely
 * 2. cofhejs initialization with backend wallet
 * 3. Async decryption flow (request → poll → get result)
 */

import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { PII_VAULT_ABI, PII_VAULT_ADDRESS } from "./abi";

// Create public client for reading contract state
const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

/**
 * Check if a call uses Fhenix encryption
 */
export function isFhenixEncrypted(encryptedHandle: string | null): boolean {
  return encryptedHandle?.startsWith("fhenix:") ?? false;
}

/**
 * Extract vault call ID from encrypted handle
 */
export function extractVaultId(encryptedHandle: string): `0x${string}` | null {
  if (!isFhenixEncrypted(encryptedHandle)) {
    return null;
  }
  const vaultId = encryptedHandle.replace("fhenix:", "");
  if (!vaultId.startsWith("0x") || vaultId.length !== 66) {
    console.error(`[Fhenix] Invalid vault ID format: ${vaultId}`);
    return null;
  }
  return vaultId as `0x${string}`;
}

/**
 * Extract phone number from encrypted handle
 * Handles both legacy and Fhenix encryption formats
 */
export async function extractPhoneNumber(encryptedHandle: string | null): Promise<string | null> {
  if (!encryptedHandle) {
    return null;
  }

  // Legacy format: encrypted_+15551234567
  if (encryptedHandle.startsWith("encrypted_")) {
    return encryptedHandle.replace("encrypted_", "");
  }

  // Fhenix format: fhenix:0x...
  if (isFhenixEncrypted(encryptedHandle)) {
    const vaultId = extractVaultId(encryptedHandle);
    if (!vaultId) {
      console.error("[Fhenix] Could not extract vault ID");
      return null;
    }

    try {
      const phone = await decryptPhoneFromVault(vaultId);
      return phone;
    } catch (error) {
      console.error("[Fhenix] Decryption failed:", error);
      return null;
    }
  }

  // Unknown format
  console.error(`[Phone] Unknown encrypted handle format: ${encryptedHandle}`);
  return null;
}

/**
 * Decrypt phone number from PIIVault contract
 * 
 * This is a placeholder that demonstrates the flow.
 * Full implementation requires backend wallet setup.
 */
async function decryptPhoneFromVault(vaultId: `0x${string}`): Promise<string | null> {
  console.log(`[Fhenix] Attempting to decrypt phone for vault ID: ${vaultId}`);

  // First, check if the call exists
  try {
    const exists = await publicClient.readContract({
      address: PII_VAULT_ADDRESS,
      abi: PII_VAULT_ABI,
      functionName: "exists",
      args: [vaultId],
    });

    if (!exists) {
      console.error(`[Fhenix] Call ID ${vaultId} does not exist in vault`);
      return null;
    }
  } catch (error) {
    console.error("[Fhenix] Error checking vault:", error);
    return null;
  }

  // TODO: Implement full decryption flow
  // For production:
  // 1. Initialize cofhejs with backend wallet
  // 2. Call requestDecryption() on contract
  // 3. Poll/wait for decryption result
  // 4. Call getDecryptedPhoneNumber()
  // 5. Convert uint64 back to phone string

  console.warn("[Fhenix] ⚠️ Backend decryption not fully implemented");
  console.warn("[Fhenix] For hackathon demo, Fhenix calls will show as pending decryption");
  
  // Return null to indicate decryption needed
  // In production, this would return the decrypted phone number
  return null;
}

/**
 * Check if a vault call ID exists in the contract
 */
export async function checkVaultIdExists(vaultId: `0x${string}`): Promise<boolean> {
  try {
    const exists = await publicClient.readContract({
      address: PII_VAULT_ADDRESS,
      abi: PII_VAULT_ABI,
      functionName: "exists",
      args: [vaultId],
    });
    return exists;
  } catch (error) {
    console.error("[Fhenix] Error checking vault:", error);
    return false;
  }
}

