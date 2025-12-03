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
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

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
    <div className="space-y-3 rounded-xl border border-border/50 bg-card/30 p-4">
      <Label className="text-sm font-medium flex items-center gap-2">
        <span>🔐</span>
        <span>Privacy Protection</span>
      </Label>

      <div className="space-y-3">
        {/* Standard Option */}
        <label
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
            value === "standard"
              ? "border-primary/50 bg-primary/5"
              : "border-border/50 hover:border-border"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
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
            <div className="font-medium text-sm">Standard</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Phone encrypted in our secure database. Fast & simple.
            </div>
          </div>
        </label>

        {/* Fhenix Option */}
        <label
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
            value === "fhenix"
              ? "border-violet-500/50 bg-violet-500/5"
              : "border-border/50 hover:border-border"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
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
            <div className="font-medium text-sm flex items-center gap-2">
              <span>Fhenix + Base Sepolia</span>
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400">
                FHE
              </span>
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                Testnet
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Phone encrypted on-chain with Fully Homomorphic Encryption.
              Only you control decryption. Uses Base Sepolia testnet.
            </div>
          </div>
        </label>

        {/* Wallet Connection Section (shown when Fhenix selected) */}
        {value === "fhenix" && (
          <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 space-y-2">
            {isConnected ? (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm text-green-400">
                      Connected: {truncateAddress(address!)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnect()}
                    className="text-xs h-7 text-muted-foreground hover:text-foreground"
                  >
                    Disconnect
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>Network: Base Sepolia</span>
                  <span className="text-muted-foreground/50">•</span>
                  <a 
                    href={FHENIX_FAUCET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
                  >
                    Get testnet ETH
                  </a>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Connect your wallet to enable FHE encryption on Base Sepolia
                </p>
                <Button
                  type="button"
                  onClick={handleConnect}
                  disabled={isPending || disabled}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white"
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
                <p className="text-xs text-muted-foreground/70 text-center">
                  Need testnet ETH?{" "}
                  <a 
                    href={FHENIX_FAUCET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
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

