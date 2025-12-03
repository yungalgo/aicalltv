/**
 * PIIVault Contract ABI
 * 
 * Network: Base Sepolia (Fhenix FHE infrastructure is only on testnets)
 * Owner/Backend: 0x8bf8e3c90f7c42c589d7bacfacaa6fa5f15648d7
 * 
 * NOTE: Contract must be deployed to Base Sepolia for FHE to work.
 * The old Base mainnet deployment won't work (no Fhenix infrastructure there).
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
        name: "requestedBy",
        type: "address",
      },
    ],
    name: "DecryptionRequested",
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
    inputs: [
      {
        internalType: "bytes32",
        name: "callId",
        type: "bytes32",
      },
    ],
    name: "requestDecryption",
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
    ],
    name: "getDecryptedPhoneNumber",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
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
    name: "checkDecryptionStatus",
    outputs: [
      {
        internalType: "bool",
        name: "isDecrypted",
        type: "bool",
      },
      {
        internalType: "uint64",
        name: "phoneNumber",
        type: "uint64",
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

/**
 * PIIVault v2 contract on Base Sepolia
 * 
 * TODO: Update this address after deploying to Base Sepolia
 * Deploy via Remix: https://remix.ethereum.org
 * 1. Connect wallet to Base Sepolia network
 * 2. Get testnet ETH from: https://docs.base.org/base-chain/tools/network-faucets
 * 3. Deploy PIIVault_v2.sol contract
 * 4. Update address below
 * 
 * Deployer wallet: 0x8bf8e3c90f7c42c589d7bacfacaa6fa5f15648d7
 * This wallet is owner & backendService - use its private key for FHENIX_BACKEND_PRIVATE_KEY
 */
export const PII_VAULT_ADDRESS = "0x0000000000000000000000000000000000000000" as const; // TODO: Update after Base Sepolia deployment

