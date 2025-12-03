/**
 * Type declarations for cofhejs package
 * Fhenix Confidential Homomorphic Encryption JavaScript SDK
 * 
 * Use: import { cofhejs, Encryptable } from "cofhejs/web"
 */

declare module "cofhejs/web" {
  export interface EncryptedInput {
    data: string | bigint;
    securityZone?: number;
    utype?: number;
    signature?: string;
  }

  export interface InitializeOptions {
    provider: unknown;
  }

  export interface CofheJS {
    initialize(options: InitializeOptions): Promise<void>;
    encrypt(inputs: EncryptableValue[]): Promise<EncryptedInput[]>;
    decrypt(data: unknown): Promise<unknown>;
  }

  export interface EncryptableValue {
    _type: string;
    _value: bigint | string | number;
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

