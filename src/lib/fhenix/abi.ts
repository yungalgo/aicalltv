/**
 * PIIVault Contract ABI
 * Deployed on Base Mainnet at: 0x7eD75e4ec7b3Df1b651654d7A7E89CeC0AcEf0a5
 */
export const PII_VAULT_ABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "callId",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "address",
        name: "storedBy",
        type: "address",
      },
    ],
    name: "PhoneStored",
    type: "event",
  },
  {
    inputs: [],
    name: "backendService",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    name: "callExists",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "callId",
        type: "bytes32",
      },
    ],
    name: "exists",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "callId",
        type: "bytes32",
      },
    ],
    name: "getEncryptedPhone",
    outputs: [
      {
        internalType: "euint64",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newBackendService",
        type: "address",
      },
    ],
    name: "setBackendService",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "callId",
        type: "bytes32",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "data",
            type: "uint256",
          },
          {
            internalType: "uint8",
            name: "securityZone",
            type: "uint8",
          },
          {
            internalType: "uint8",
            name: "utype",
            type: "uint8",
          },
          {
            internalType: "bytes",
            name: "signature",
            type: "bytes",
          },
        ],
        internalType: "struct InEuint64",
        name: "encryptedPhone",
        type: "tuple",
      },
    ],
    name: "storePhone",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const PII_VAULT_ADDRESS = "0x7eD75e4ec7b3Df1b651654d7A7E89CeC0AcEf0a5" as const;

