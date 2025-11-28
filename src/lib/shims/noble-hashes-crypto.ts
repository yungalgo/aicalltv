/**
 * Shim for @noble/hashes/crypto export issue
 * Some versions of @noble/hashes import from './crypto' which isn't always exported
 * This provides the crypto object needed by the library
 */
export const crypto =
  typeof globalThis === "object" && "crypto" in globalThis
    ? globalThis.crypto
    : undefined;

