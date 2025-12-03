/**
 * Type declarations for cofhejs package
 * Fhenix Confidential Homomorphic Encryption JavaScript SDK
 * 
 * Use: import { cofhejs, Encryptable } from "cofhejs/web"
 */

declare module "cofhejs/web" {
  export interface Result<T> {
    success: boolean;
    data: T | null;
    error: Error | null;
  }

  export interface EncryptedInput {
    data: bigint;
    securityZone: number;
    utype: number;
    signature: string;
  }

  export interface ViemInitializeOptions {
    viemClient: unknown;
    viemWalletClient?: unknown;
    generatePermit?: boolean;
    ignoreErrors?: boolean;
    environment?: string;
  }

  export interface CofheJS {
    initialize(options: unknown): Promise<Result<unknown>>;
    initializeWithViem(options: ViemInitializeOptions): Promise<Result<unknown>>;
    encrypt(inputs: EncryptableValue[]): Promise<Result<EncryptedInput[]>>;
    decrypt(data: unknown): Promise<Result<unknown>>;
  }

  export interface EncryptableValue {
    data: bigint | number;
    securityZone: number;
    utype: number;
  }

  export const cofhejs: CofheJS;

  export const Encryptable: {
    uint64(value: bigint | number): EncryptableValue;
    uint128(value: bigint | number): EncryptableValue;
    uint256(value: bigint | number): EncryptableValue;
    bool(value: boolean): EncryptableValue;
    string(value: string): EncryptableValue;
  };
}

declare module "cofhejs/node" {
  export * from "cofhejs/web";
}

