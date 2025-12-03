/**
 * Fhenix Privacy Toggle Component
 * 
 * Allows users to choose between standard encryption (server-side)
 * and Fhenix FHE encryption (client-side, on-chain).
 * 
 * When Fhenix is selected, user must connect their Base wallet
 * to enable client-side encryption of their phone number.
 */

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";

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
  const [isExpanded, setIsExpanded] = useState(false);

  const handleModeChange = (mode: PrivacyMode) => {
    onChange(mode);
    if (mode === "fhenix") {
      setIsExpanded(true);
    }
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
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <span>🔐</span>
          <span>Privacy Protection</span>
        </Label>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? "Hide options" : "Show options"}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-3 pt-2">
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
                <span>Fhenix + Base</span>
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400">
                  FHE
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Phone encrypted on-chain with Fully Homomorphic Encryption.
                Only you control decryption. Requires Base wallet.
              </div>
            </div>
          </label>

          {/* Wallet Connection Section (shown when Fhenix selected) */}
          {value === "fhenix" && (
            <div className="mt-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
              {isConnected ? (
                <div className="flex items-center justify-between">
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
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Connect your Base wallet to enable FHE encryption
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
                        Connect Base Wallet
                      </span>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Collapsed state - just show current selection */}
      {!isExpanded && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {value === "standard" ? (
            <>
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Standard encryption</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              <span>Fhenix FHE encryption</span>
              {isConnected && (
                <span className="text-green-400">• Wallet connected</span>
              )}
              {!isConnected && (
                <span className="text-amber-400">• Wallet required</span>
              )}
            </>
          )}
        </div>
      )}
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

