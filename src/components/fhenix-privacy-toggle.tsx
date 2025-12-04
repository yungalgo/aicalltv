/**
 * Fhenix Privacy Toggle Component
 * 
 * Allows users to choose between standard encryption (server-side)
 * and Fhenix FHE encryption (client-side, on-chain).
 * 
 * When Fhenix is selected, user must connect their Base wallet
 * to enable client-side encryption of their phone number.
 */

import { useCallback, useState } from "react";
import { useAccount, useConnect, useDisconnect, useWalletClient, usePublicClient, useSwitchChain } from "wagmi";
import { baseSepolia } from "viem/chains";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import {
  initializeFhenix,
  isFhenixInitialized,
  encryptAndStorePhone,
} from "~/lib/fhenix";
import { FHENIX_FAUCET_URL } from "~/lib/web3/config";

export type PrivacyMode = "standard" | "fhenix";

interface FhenixPrivacyToggleProps {
  value: PrivacyMode;
  onChange: (mode: PrivacyMode) => void;
  disabled?: boolean;
}

export function FhenixPrivacyToggle({
  value,
  onChange,
  disabled = false,
}: FhenixPrivacyToggleProps) {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  
  // Check if on correct network
  const isOnCorrectNetwork = chain?.id === baseSepolia.id;

  const handleModeChange = (mode: PrivacyMode) => {
    onChange(mode);
  };

  const handleConnect = () => {
    // Use the first available connector (MetaMask)
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: '#1A1A1A', backgroundColor: 'rgba(255, 252, 242, 0.3)' }}>
      <Label className="text-sm font-medium flex items-center gap-2" style={{ color: '#1A1A1A' }}>
        <span>🔐</span>
        <span>Privacy Protection</span>
      </Label>

      <div className="space-y-3">
        {/* Standard Option */}
        <label
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
            value === "standard"
              ? ""
              : ""
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          style={{
            borderColor: value === "standard" ? '#1A1A1A' : '#1A1A1A',
            backgroundColor: value === "standard" ? 'rgba(26, 26, 26, 0.05)' : 'transparent'
          }}
        >
          <input
            type="radio"
            name="privacyMode"
            value="standard"
            checked={value === "standard"}
            onChange={() => handleModeChange("standard")}
            disabled={disabled}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="font-medium text-sm" style={{ color: '#1A1A1A' }}>Standard</div>
            <div className="text-xs mt-0.5" style={{ color: '#1A1A1A', opacity: 0.7 }}>
              Phone encrypted in our secure database. Fast & simple.
            </div>
          </div>
        </label>

        {/* Fhenix Option */}
        <label
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
            value === "fhenix"
              ? ""
              : ""
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          style={{
            borderColor: value === "fhenix" ? '#8b5cf6' : '#1A1A1A',
            backgroundColor: value === "fhenix" ? 'rgba(139, 92, 246, 0.05)' : 'transparent'
          }}
        >
          <input
            type="radio"
            name="privacyMode"
            value="fhenix"
            checked={value === "fhenix"}
            onChange={() => handleModeChange("fhenix")}
            disabled={disabled}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="font-medium text-sm flex items-center gap-2" style={{ color: '#1A1A1A' }}>
              <span>Fhenix + Base Sepolia</span>
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6' }}>
                FHE
              </span>
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
                Testnet
              </span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#1A1A1A', opacity: 0.7 }}>
              Phone encrypted on-chain with Fully Homomorphic Encryption.
              Only you control decryption. Uses Base Sepolia testnet.
            </div>
          </div>
        </label>

        {/* Wallet Connection Section (shown when Fhenix selected) */}
        {value === "fhenix" && (
          <div className="p-3 rounded-lg border space-y-2" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
            {isConnected && isOnCorrectNetwork ? (
              /* Connected AND on correct network */
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm" style={{ color: '#22c55e' }}>
                      Connected: {truncateAddress(address!)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnect()}
                    className="text-xs h-7"
                    style={{ color: '#1A1A1A', opacity: 0.7 }}
                  >
                    Disconnect
                  </Button>
                </div>
                <div className="text-xs flex items-center gap-1.5" style={{ color: '#1A1A1A', opacity: 0.7 }}>
                  <span>Network: Base Sepolia</span>
                  <span style={{ opacity: 0.5 }}>•</span>
                  <a 
                    href={FHENIX_FAUCET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                    style={{ color: '#8b5cf6' }}
                  >
                    Get testnet ETH
                  </a>
                </div>
              </>
            ) : isConnected && !isOnCorrectNetwork ? (
              /* Connected but WRONG network */
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-sm" style={{ color: '#f59e0b' }}>
                      Wrong Network: {chain?.name || "Unknown"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnect()}
                    className="text-xs h-7"
                    style={{ color: '#1A1A1A', opacity: 0.7 }}
                  >
                    Disconnect
                  </Button>
                </div>
                <p className="text-xs" style={{ color: '#f59e0b', opacity: 0.8 }}>
                  Please switch to Base Sepolia to use FHE encryption
                </p>
                <Button
                  type="button"
                  onClick={() => switchChain?.({ chainId: baseSepolia.id })}
                  disabled={isSwitching || disabled}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  size="sm"
                >
                  {isSwitching ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Switching...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      Switch to Base Sepolia
                    </span>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: '#1A1A1A', opacity: 0.7 }}>
                  Connect your wallet to enable FHE encryption on Base Sepolia
                </p>
                <Button
                  type="button"
                  onClick={handleConnect}
                  disabled={isPending || disabled}
                  className="w-full text-white"
                  style={{ backgroundColor: '#8b5cf6' }}
                  size="sm"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Connecting...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M12 2L2 7L12 12L22 7L12 2Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M2 17L12 22L22 17"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M2 12L12 17L22 12"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Connect Wallet
                    </span>
                  )}
                </Button>
                <p className="text-xs text-center" style={{ color: '#1A1A1A', opacity: 0.7 }}>
                  Need testnet ETH?{" "}
                  <a 
                    href={FHENIX_FAUCET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                    style={{ color: '#8b5cf6' }}
                  >
                    Get from faucet
                  </a>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to check if Fhenix submission is ready
 * Returns true if standard mode OR (fhenix mode AND wallet connected)
 */
export function useFhenixReady(mode: PrivacyMode): boolean {
  const { isConnected } = useAccount();
  
  if (mode === "standard") return true;
  return isConnected;
}

/**
 * Hook to handle Fhenix encryption for the call form
 * Returns the encrypt function and loading/error states
 */
export function useFhenixEncryption() {
  const { isConnected, address, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient({ chainId: baseSepolia.id });
  const publicClient = usePublicClient({ chainId: baseSepolia.id });
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Check if user is on the correct network
  const isOnCorrectNetwork = chain?.id === baseSepolia.id;

  /**
   * Initialize Fhenix with current wallet
   */
  const initialize = useCallback(async () => {
    if (!walletClient || !publicClient) {
      setEncryptionError("Wallet not connected");
      return false;
    }

    try {
      const success = await initializeFhenix(walletClient, publicClient);
      setIsInitialized(success);
      if (!success) {
        setEncryptionError("Failed to initialize Fhenix");
      }
      return success;
    } catch (error) {
      setEncryptionError(error instanceof Error ? error.message : "Initialization failed");
      return false;
    }
  }, [walletClient, publicClient]);

  /**
   * Encrypt and store phone number on-chain
   * Returns the vault call ID for later decryption
   */
  const encryptPhone = useCallback(async (phoneNumber: string): Promise<{
    callId: `0x${string}`;
    txHash: `0x${string}`;
  } | null> => {
    if (!walletClient || !publicClient) {
      setEncryptionError("Wallet not connected");
      return null;
    }

    setIsEncrypting(true);
    setEncryptionError(null);

    try {
      // Initialize if not already
      if (!isFhenixInitialized()) {
        const initialized = await initialize();
        if (!initialized) {
          return null;
        }
      }

      // Encrypt and store
      const result = await encryptAndStorePhone(walletClient, publicClient, phoneNumber);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Encryption failed";
      setEncryptionError(message);
      console.error("Fhenix encryption error:", error);
      return null;
    } finally {
      setIsEncrypting(false);
    }
  }, [walletClient, publicClient, initialize]);

  // Switch to Base Sepolia
  const switchToBaseSepolia = useCallback(async () => {
    try {
      await switchChain?.({ chainId: baseSepolia.id });
      return true;
    } catch (error) {
      console.error("Failed to switch network:", error);
      return false;
    }
  }, [switchChain]);

  return {
    isConnected,
    address,
    isEncrypting,
    isInitialized,
    encryptionError,
    encryptPhone,
    initialize,
    isOnCorrectNetwork,
    switchToBaseSepolia,
    requiredChainId: baseSepolia.id,
    requiredChainName: "Base Sepolia",
  };
}

