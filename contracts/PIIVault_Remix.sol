// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// ============================================================================
// PIIVault - Remix Deployment Version
// ============================================================================
// 
// DEPLOYMENT INSTRUCTIONS FOR REMIX:
// 
// 1. Go to https://remix.ethereum.org
// 2. Create a new file called "PIIVault.sol" and paste this entire content
// 3. In the Solidity Compiler tab:
//    - Select compiler version 0.8.25
//    - Enable optimization (200 runs)
//    - Set EVM Version to "cancun"
// 4. Compile the contract
// 5. In the Deploy tab:
//    - Select "Injected Provider - MetaMask"
//    - Make sure MetaMask is on Base Mainnet (chain ID 8453)
//    - Deploy PIIVault contract
// 6. Copy the deployed contract address and share it with the dev team
//
// NOTE: You need to install the cofhe-contracts package in Remix:
//   - In Remix, go to Plugin Manager
//   - Make sure "Solidity compiler" is activated
//   - The import below should resolve automatically if using Remix's npm resolver
//
// Alternative: Use the npm import syntax that Remix supports
// ============================================================================

// Import FHE library from npm package (Remix resolves this)
import "@fhenixprotocol/cofhe-contracts/contracts/FHE.sol";

/**
 * @title PIIVault
 * @notice Stores encrypted phone numbers for privacy-preserving call service
 * @dev Uses Fhenix CoFHE for Fully Homomorphic Encryption on Base
 * 
 * Phone numbers are encrypted on-chain - only authorized parties can decrypt.
 * This protects user privacy: even with database/chain access, PII is hidden.
 */
contract PIIVault {
    // Mapping from call ID (bytes32) to encrypted phone number
    mapping(bytes32 => euint64) private encryptedPhones;
    
    // Mapping to track which call IDs exist
    mapping(bytes32 => bool) public callExists;
    
    // Owner of the vault (can be used for admin functions)
    address public owner;
    
    // Backend service address that can request decryptions
    address public backendService;
    
    // Events
    event PhoneStored(bytes32 indexed callId, address indexed storedBy);
    event DecryptionRequested(bytes32 indexed callId, address indexed requestedBy);
    event BackendServiceUpdated(address indexed oldService, address indexed newService);
    
    constructor() {
        owner = msg.sender;
        backendService = msg.sender; // Initially set to deployer
    }
    
    /**
     * @notice Update the backend service address that can decrypt
     * @param newBackendService The new backend service address
     */
    function setBackendService(address newBackendService) external {
        require(msg.sender == owner, "Only owner");
        emit BackendServiceUpdated(backendService, newBackendService);
        backendService = newBackendService;
    }
    
    /**
     * @notice Store an encrypted phone number for a call
     * @param callId Unique identifier for the call (UUID as bytes32)
     * @param encryptedPhone The encrypted phone number from client
     */
    function storePhone(bytes32 callId, InEuint64 memory encryptedPhone) external {
        require(!callExists[callId], "Call ID already exists");
        
        // Convert input to FHE type and store
        euint64 phone = FHE.asEuint64(encryptedPhone);
        encryptedPhones[callId] = phone;
        callExists[callId] = true;
        
        // Allow this contract to operate on the value
        FHE.allowThis(phone);
        
        // Allow the sender to decrypt their own data
        FHE.allowSender(phone);
        
        // Allow backend service to decrypt
        if (backendService != address(0)) {
            FHE.allow(phone, backendService);
        }
        
        emit PhoneStored(callId, msg.sender);
    }
    
    /**
     * @notice Get the encrypted phone number for a call
     * @param callId The call ID to look up
     * @return The encrypted phone number handle
     */
    function getEncryptedPhone(bytes32 callId) external view returns (euint64) {
        require(callExists[callId], "Call ID does not exist");
        return encryptedPhones[callId];
    }
    
    /**
     * @notice Request decryption of a phone number
     * @dev This initiates the async decryption process via CoFHE
     * @param callId The call ID to decrypt
     */
    function requestDecryption(bytes32 callId) external {
        require(callExists[callId], "Call ID does not exist");
        
        euint64 phone = encryptedPhones[callId];
        
        // Grant sender permission to decrypt
        FHE.allowSender(phone);
        
        // Request decryption via CoFHE network
        FHE.decrypt(phone);
        
        emit DecryptionRequested(callId, msg.sender);
    }
    
    /**
     * @notice Get the decrypted phone number (after decryption completes)
     * @param callId The call ID to get decrypted value for
     * @return value The decrypted phone number
     * @return ready Whether the decryption is complete
     */
    function getDecryptedPhone(bytes32 callId) external view returns (uint256 value, bool ready) {
        require(callExists[callId], "Call ID does not exist");
        
        euint64 phone = encryptedPhones[callId];
        (value, ready) = FHE.getDecryptResultSafe(phone);
    }
    
    /**
     * @notice Grant decryption permission to a specific address
     * @dev Allows backend service address to decrypt phones
     * @param callId The call ID to grant access for
     * @param account The address to grant access to
     */
    function grantAccess(bytes32 callId, address account) external {
        require(callExists[callId], "Call ID does not exist");
        require(msg.sender == owner, "Only owner can grant access");
        
        euint64 phone = encryptedPhones[callId];
        FHE.allow(phone, account);
    }
    
    /**
     * @notice Check if a call ID exists in the vault
     * @param callId The call ID to check
     * @return Whether the call exists
     */
    function exists(bytes32 callId) external view returns (bool) {
        return callExists[callId];
    }
}

