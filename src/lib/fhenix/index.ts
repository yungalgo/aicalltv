/**
 * Fhenix FHE Integration
 * 
 * This module provides client-side encryption for sensitive PII
 * using Fhenix Fully Homomorphic Encryption on Base mainnet.
 * 
 * Contract: 0x7eD75e4ec7b3Df1b651654d7A7E89CeC0AcEf0a5
 */

export * from "./abi";
export * from "./encryption";
// Backend decryption is exported separately to avoid importing viem on client
// Use: import { extractPhoneNumber } from "~/lib/fhenix/backend-decrypt"

