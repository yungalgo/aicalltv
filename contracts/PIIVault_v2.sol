// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// Import FHE.sol directly from GitHub for Remix compatibility
import "https://raw.githubusercontent.com/FhenixProtocol/cofhe-contracts/master/contracts/FHE.sol";

/**
 * @title PIIVault v2
 * @notice Stores encrypted phone numbers using Fhenix FHE on Base
 * @dev This version includes decryption functions for backend use
 * 
 * Deployed by: Your wallet (becomes owner & backendService)
 * Contract: Deploy this to Base mainnet via Remix
 */
contract PIIVault {
    // Storage
    mapping(bytes32 => euint64) private encryptedPhones;
    mapping(bytes32 => bool) public callExists;
    address public owner;
    address public backendService;
    
    // Events
    event PhoneStored(bytes32 indexed callId, address indexed storedBy);
    event DecryptionRequested(bytes32 indexed callId, address indexed requestedBy);
    
    constructor() {
        owner = msg.sender;
        backendService = msg.sender; // Owner is default backend
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyAuthorized(bytes32 callId) {
        require(
            msg.sender == owner || 
            msg.sender == backendService ||
            FHE.isAllowed(encryptedPhones[callId], msg.sender),
            "Not authorized"
        );
        _;
    }
    
    /**
     * @notice Set the backend service address that can decrypt
     * @param newBackendService The new backend address
     */
    function setBackendService(address newBackendService) external onlyOwner {
        backendService = newBackendService;
    }
    
    /**
     * @notice Store an encrypted phone number
     * @param callId Unique identifier for this call
     * @param encryptedPhone The FHE-encrypted phone number
     */
    function storePhone(bytes32 callId, InEuint64 memory encryptedPhone) external {
        require(!callExists[callId], "Call ID already exists");
        
        euint64 phone = FHE.asEuint64(encryptedPhone);
        encryptedPhones[callId] = phone;
        callExists[callId] = true;
        
        // Grant permissions
        FHE.allowThis(phone);      // Allow contract to use
        FHE.allowSender(phone);    // Allow user to decrypt
        if (backendService != address(0)) {
            FHE.allow(phone, backendService); // Allow backend to decrypt
        }
        
        emit PhoneStored(callId, msg.sender);
    }
    
    /**
     * @notice Request decryption of a phone number
     * @dev Triggers async FHE decryption. Poll getDecryptedPhoneNumber for result.
     * @param callId The call ID to decrypt
     */
    function requestDecryption(bytes32 callId) external onlyAuthorized(callId) {
        require(callExists[callId], "Call ID does not exist");
        FHE.decrypt(encryptedPhones[callId]);
        emit DecryptionRequested(callId, msg.sender);
    }
    
    /**
     * @notice Get the decrypted phone number
     * @dev Call this after requestDecryption. Returns 0 if not ready.
     * @param callId The call ID to get
     * @return The decrypted phone number as uint64
     */
    function getDecryptedPhoneNumber(bytes32 callId) external view returns (uint64) {
        require(callExists[callId], "Call ID does not exist");
        (uint64 value, bool decrypted) = FHE.getDecryptResultSafe(encryptedPhones[callId]);
        require(decrypted, "Phone not yet decrypted");
        return value;
    }
    
    /**
     * @notice Check if decryption is complete
     * @param callId The call ID to check
     * @return isDecrypted True if decryption is complete
     * @return phoneNumber The decrypted value (0 if not ready)
     */
    function checkDecryptionStatus(bytes32 callId) external view returns (bool isDecrypted, uint64 phoneNumber) {
        require(callExists[callId], "Call ID does not exist");
        (uint64 value, bool decrypted) = FHE.getDecryptResultSafe(encryptedPhones[callId]);
        return (decrypted, value);
    }
    
    /**
     * @notice Get the encrypted phone (for verification)
     * @param callId The call ID
     * @return The encrypted euint64 handle
     */
    function getEncryptedPhone(bytes32 callId) external view returns (euint64) {
        require(callExists[callId], "Call ID does not exist");
        return encryptedPhones[callId];
    }
    
    /**
     * @notice Check if a call ID exists
     * @param callId The call ID to check
     * @return True if exists
     */
    function exists(bytes32 callId) external view returns (bool) {
        return callExists[callId];
    }
}

