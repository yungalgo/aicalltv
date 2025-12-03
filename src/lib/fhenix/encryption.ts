/**
 * Fhenix FHE Encryption Service
 * 
 * Handles client-side encryption of phone numbers using cofhejs
 * and storage on the PIIVault contract on Base mainnet.
 */

import { cofhejs, Encryptable } from "cofhejs/web";
import { encodeAbiParameters, keccak256 } from "viem";
import type { WalletClient, PublicClient } from "viem";
import { PII_VAULT_ABI, PII_VAULT_ADDRESS } from "./abi";

// Store initialization state
let isInitialized = false;

/**
 * Initialize cofhejs with the user's wallet
 * Must be called before any encryption operations
 */
export async function initializeFhenix(
  walletClient: WalletClient,
  publicClient: PublicClient
): Promise<boolean> {
  try {
    console.log("🔐 Initializing Fhenix with viem clients...");
    console.log("🔐 Public client chain:", publicClient.chain?.name);
    console.log("🔐 Wallet account:", walletClient.account?.address);
    
    // Use initializeWithViem for proper viem integration
    // Environment "MAINNET" connects to Fhenix CoFHE on Base mainnet
    const result = await cofhejs.initializeWithViem({
      viemClient: publicClient,
      viemWalletClient: walletClient,
      generatePermit: true,
      ignoreErrors: false,
      environment: "MAINNET",
    });
    
    console.log("🔐 Initialize result:", result);
    
    if (!result.success) {
      console.error("❌ Fhenix initialization failed:", result.error);
      isInitialized = false;
      return false;
    }
    
    isInitialized = true;
    console.log("✅ Fhenix CoFHE initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize Fhenix:", error);
    isInitialized = false;
    return false;
  }
}

/**
 * Check if Fhenix is initialized
 */
export function isFhenixInitialized(): boolean {
  return isInitialized;
}

/**
 * Generate a unique call ID from user address and timestamp
 */
export function generateCallId(userAddress: string, timestamp: number = Date.now()): `0x${string}` {
  const packed = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [userAddress as `0x${string}`, BigInt(timestamp)]
  );
  return keccak256(packed);
}

/**
 * Convert phone number string to uint64
 * Strips non-numeric characters and converts to number
 */
export function phoneToUint64(phone: string): bigint {
  // Remove all non-numeric characters except leading +
  const cleaned = phone.replace(/[^\d]/g, "");
  const num = BigInt(cleaned);
  
  // Validate it fits in uint64
  if (num > BigInt("18446744073709551615")) {
    throw new Error("Phone number too large for uint64");
  }
  
  return num;
}

/**
 * Convert uint64 back to phone number string
 */
export function uint64ToPhone(num: bigint): string {
  const str = num.toString();
  // Format as +1-XXX-XXX-XXXX if US number
  if (str.length === 11 && str.startsWith("1")) {
    return `+1-${str.slice(1, 4)}-${str.slice(4, 7)}-${str.slice(7)}`;
  }
  return `+${str}`;
}

/**
 * Encrypt a phone number using Fhenix FHE
 * Returns the encrypted input struct for the contract
 */
export async function encryptPhoneNumber(
  phoneNumber: string
): Promise<{
  data: bigint;
  securityZone: number;
  utype: number;
  signature: `0x${string}`;
}> {
  if (!isInitialized) {
    throw new Error("Fhenix not initialized. Call initializeFhenix first.");
  }

  try {
    // Convert phone to uint64
    const phoneUint64 = phoneToUint64(phoneNumber);
    console.log("📱 Phone as uint64:", phoneUint64.toString());
    
    // Encrypt using cofhejs
    const encryptedInput = Encryptable.uint64(phoneUint64);
    console.log("🔐 Encryptable input:", encryptedInput);
    
    const encryptResult = await cofhejs.encrypt([encryptedInput]);
    console.log("🔐 Encrypt result:", encryptResult);
    
    // cofhejs.encrypt returns a Result<T> object
    if (!encryptResult.success) {
      console.error("🔐 Encryption failed:", encryptResult.error);
      throw encryptResult.error || new Error("Encryption failed");
    }
    
    const encryptedArray = encryptResult.data;
    console.log("🔐 Encrypted data array:", encryptedArray);
    
    if (!encryptedArray || encryptedArray.length === 0) {
      throw new Error("Encryption returned empty result");
    }
    
    const encrypted = encryptedArray[0];
    console.log("🔐 First encrypted item:", encrypted);
    console.log("🔐 Encrypted keys:", encrypted ? Object.keys(encrypted) : "null");
    
    return {
      data: BigInt(encrypted.data),
      securityZone: encrypted.securityZone || 0,
      utype: encrypted.utype || 5, // euint64 type
      signature: (encrypted.signature as `0x${string}`) || "0x",
    };
  } catch (error) {
    console.error("❌ Failed to encrypt phone number:", error);
    throw error;
  }
}

/**
 * Store encrypted phone number on the PIIVault contract
 */
export async function storeEncryptedPhone(
  walletClient: WalletClient,
  publicClient: PublicClient,
  callId: `0x${string}`,
  encryptedPhone: {
    data: bigint;
    securityZone: number;
    utype: number;
    signature: `0x${string}`;
  }
): Promise<`0x${string}`> {
  if (!walletClient.account) {
    throw new Error("No wallet account connected");
  }

  try {
    // Simulate the transaction first
    const { request } = await publicClient.simulateContract({
      address: PII_VAULT_ADDRESS,
      abi: PII_VAULT_ABI,
      functionName: "storePhone",
      args: [
        callId,
        {
          data: encryptedPhone.data,
          securityZone: encryptedPhone.securityZone,
          utype: encryptedPhone.utype,
          signature: encryptedPhone.signature,
        },
      ],
      account: walletClient.account,
    });

    // Execute the transaction
    const txHash = await walletClient.writeContract(request);
    
    // Wait for confirmation
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    
    console.log("✅ Phone stored on PIIVault:", txHash);
    return txHash;
  } catch (error) {
    console.error("❌ Failed to store encrypted phone:", error);
    throw error;
  }
}

/**
 * Check if a call ID already exists in the vault
 */
export async function checkCallIdExists(
  publicClient: PublicClient,
  callId: `0x${string}`
): Promise<boolean> {
  try {
    const exists = await publicClient.readContract({
      address: PII_VAULT_ADDRESS,
      abi: PII_VAULT_ABI,
      functionName: "exists",
      args: [callId],
    });
    return exists;
  } catch (error) {
    console.error("Failed to check call ID:", error);
    return false;
  }
}

/**
 * Full flow: encrypt phone and store on contract
 * Returns the call ID that can be used to retrieve/decrypt later
 */
export async function encryptAndStorePhone(
  walletClient: WalletClient,
  publicClient: PublicClient,
  phoneNumber: string
): Promise<{
  callId: `0x${string}`;
  txHash: `0x${string}`;
}> {
  if (!walletClient.account) {
    throw new Error("No wallet account connected");
  }

  // Generate unique call ID
  const callId = generateCallId(walletClient.account.address);
  
  // Check if call ID already exists (very unlikely with timestamp)
  const exists = await checkCallIdExists(publicClient, callId);
  if (exists) {
    throw new Error("Call ID collision - please try again");
  }

  // Encrypt the phone number
  const encrypted = await encryptPhoneNumber(phoneNumber);
  
  // Store on contract
  const txHash = await storeEncryptedPhone(
    walletClient,
    publicClient,
    callId,
    encrypted
  );

  return { callId, txHash };
}

