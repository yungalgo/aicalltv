/**
 * Backend Fhenix Decryption Service
 * 
 * Handles server-side decryption of phone numbers stored in the PIIVault contract.
 * The backend service address must be set as an allowed decryptor in the contract.
 * 
 * Contract: 0xc6d16980078e5613EDCe9B332d1F25810e57d9CB (Base Sepolia)
 */

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { env } from "~/env/server";
import { PII_VAULT_ABI, PII_VAULT_ADDRESS } from "./abi";

// Create public client for reading contract state (Base Sepolia)
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

/**
 * Get or create backend wallet client for transactions
 */
function getBackendWalletClient() {
  if (!env.FHENIX_BACKEND_PRIVATE_KEY) {
    throw new Error("FHENIX_BACKEND_PRIVATE_KEY not configured");
  }

  const privateKey = env.FHENIX_BACKEND_PRIVATE_KEY.startsWith("0x")
    ? env.FHENIX_BACKEND_PRIVATE_KEY as `0x${string}`
    : `0x${env.FHENIX_BACKEND_PRIVATE_KEY}` as `0x${string}`;

  const account = privateKeyToAccount(privateKey);
  
  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });
}

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
 * Convert uint64 back to phone number string
 */
function uint64ToPhone(num: bigint): string {
  const str = num.toString();
  // Format as +1XXXXXXXXXX if US number (11 digits starting with 1)
  if (str.length === 11 && str.startsWith("1")) {
    return `+${str}`;
  }
  // Otherwise just prefix with +
  return `+${str}`;
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

/**
 * Request decryption for a vault ID
 * This triggers the async FHE decryption process on-chain
 */
async function requestDecryption(vaultId: `0x${string}`): Promise<`0x${string}`> {
  console.log(`[Fhenix] 🔐 Requesting decryption for vault ID: ${vaultId}`);
  
  const walletClient = getBackendWalletClient();
  
  // Simulate first
  const { request } = await publicClient.simulateContract({
    address: PII_VAULT_ADDRESS,
    abi: PII_VAULT_ABI,
    functionName: "requestDecryption",
    args: [vaultId],
    account: walletClient.account,
  });

  // Send transaction
  const txHash = await walletClient.writeContract(request);
  console.log(`[Fhenix] 📝 Decryption request tx: ${txHash}`);

  // Wait for confirmation
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`[Fhenix] ✅ Decryption request confirmed`);

  return txHash;
}

/**
 * Poll for decryption result with exponential backoff
 */
async function pollForDecryptionResult(
  vaultId: `0x${string}`,
  maxAttempts: number = 30,
  initialDelayMs: number = 2000
): Promise<bigint | null> {
  console.log(`[Fhenix] ⏳ Polling for decryption result...`);

  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt < maxAttempts) {
    try {
      // Call the view function to check if decryption is complete
      const result = await publicClient.readContract({
        address: PII_VAULT_ADDRESS,
        abi: PII_VAULT_ABI,
        functionName: "getDecryptedPhoneNumber",
        args: [vaultId],
      });

      // Result is the uint64 phone number if decryption succeeded
      // If it throws, decryption isn't complete yet
      console.log(`[Fhenix] ✅ Decryption complete! Result: ${result}`);
      return result;
    } catch (error) {
      // Check if error indicates "not yet decrypted"
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes("not yet decrypted") || errorMessage.includes("revert")) {
        attempt++;
        console.log(`[Fhenix] ⏳ Attempt ${attempt}/${maxAttempts} - not ready yet, waiting ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Exponential backoff with cap
        delay = Math.min(delay * 1.5, 10000);
      } else {
        // Unexpected error
        console.error(`[Fhenix] ❌ Unexpected error polling:`, error);
        throw error;
      }
    }
  }

  console.error(`[Fhenix] ❌ Decryption polling timed out after ${maxAttempts} attempts`);
  return null;
}

/**
 * Full decryption flow: request decryption and poll for result
 */
async function decryptPhoneFromVault(vaultId: `0x${string}`): Promise<string | null> {
  console.log(`[Fhenix] 🔐 Starting decryption for vault ID: ${vaultId}`);

  // Check if backend private key is configured
  if (!env.FHENIX_BACKEND_PRIVATE_KEY) {
    console.error("[Fhenix] ❌ FHENIX_BACKEND_PRIVATE_KEY not configured");
    console.error("[Fhenix] To enable Fhenix decryption, set this env var to the private key");
    console.error("[Fhenix] of the wallet set as backendService in the PIIVault contract");
    return null;
  }

  // First, check if the call exists
  const exists = await checkVaultIdExists(vaultId);
  if (!exists) {
    console.error(`[Fhenix] ❌ Call ID ${vaultId} does not exist in vault`);
    return null;
  }

  try {
    // Step 1: Request decryption (triggers async FHE operation)
    await requestDecryption(vaultId);

    // Step 2: Poll for result
    const decryptedValue = await pollForDecryptionResult(vaultId);

    if (decryptedValue === null) {
      console.error("[Fhenix] ❌ Failed to get decrypted value");
      return null;
    }

    // Step 3: Convert uint64 to phone string
    const phoneNumber = uint64ToPhone(decryptedValue);
    console.log(`[Fhenix] ✅ Decrypted phone number: ${phoneNumber.slice(0, 5)}****`);

    return phoneNumber;
  } catch (error) {
    console.error("[Fhenix] ❌ Decryption failed:", error);
    return null;
  }
}

/**
 * Check if backend can decrypt (has private key configured)
 */
export function canDecrypt(): boolean {
  return !!env.FHENIX_BACKEND_PRIVATE_KEY;
}

/**
 * Get the backend wallet address (for verification)
 */
export function getBackendAddress(): string | null {
  if (!env.FHENIX_BACKEND_PRIVATE_KEY) {
    return null;
  }
  
  try {
    const privateKey = env.FHENIX_BACKEND_PRIVATE_KEY.startsWith("0x")
      ? env.FHENIX_BACKEND_PRIVATE_KEY as `0x${string}`
      : `0x${env.FHENIX_BACKEND_PRIVATE_KEY}` as `0x${string}`;
    
    const account = privateKeyToAccount(privateKey);
    return account.address;
  } catch {
    return null;
  }
}
