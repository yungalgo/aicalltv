import { useEffect, useState } from "react";
import builtOnNearUrl from "~/assets/badges/built-on-near.svg";
import builtOnNearDarkUrl from "~/assets/badges/built-on-near-dark.svg";
import builtOnZcashUrl from "~/assets/badges/built-on-zcash.svg";
import builtOnZcashDarkUrl from "~/assets/badges/built-on-zcash-dark.svg";
import builtOnStarknetUrl from "~/assets/badges/built-on-starknet.svg";
import builtOnStarknetDarkUrl from "~/assets/badges/built-on-starknet-dark.svg";
import builtOnSolanaUrl from "~/assets/badges/built-on-solana.svg";
import builtOnSolanaDarkUrl from "~/assets/badges/built-on-solana-dark.svg";
import builtOnBaseUrl from "~/assets/badges/built-on-base.svg";
import builtOnBaseDarkUrl from "~/assets/badges/built-on-base-dark.svg";
import builtOnFhenixUrl from "~/assets/badges/built-on-fhenix.svg";
import builtOnFhenixDarkUrl from "~/assets/badges/built-on-fhenix-dark.svg";
import { cn } from "~/lib/utils";

interface BuiltOnBadgeProps {
  className?: string;
  href?: string;
  variant?: "near" | "zcash" | "starknet" | "solana" | "base" | "fhenix";
  /** Force dark mode styling (for use on dark backgrounds) */
  forceDark?: boolean;
}

export function BuiltOnBadge({ className, href, variant = "near", forceDark }: BuiltOnBadgeProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Skip theme detection if forceDark is set
    if (forceDark !== undefined) return;
    
    // Check initial theme
    const checkTheme = () => {
      if (typeof window !== "undefined") {
        setIsDark(document.documentElement.classList.contains("dark"));
      }
    };

    // Check on mount
    checkTheme();

    // Watch for theme changes
    if (typeof window !== "undefined") {
      const observer = new MutationObserver(checkTheme);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });

      return () => observer.disconnect();
    }
  }, [forceDark]);

  // Use forceDark if provided, otherwise use detected theme
  const useDarkVariant = forceDark !== undefined ? forceDark : isDark;
  
  const badgeSrc = variant === "zcash" 
    ? (useDarkVariant ? builtOnZcashDarkUrl : builtOnZcashUrl)
    : variant === "starknet"
    ? (useDarkVariant ? builtOnStarknetDarkUrl : builtOnStarknetUrl)
    : variant === "solana"
    ? (useDarkVariant ? builtOnSolanaDarkUrl : builtOnSolanaUrl)
    : variant === "base"
    ? (useDarkVariant ? builtOnBaseDarkUrl : builtOnBaseUrl)
    : variant === "fhenix"
    ? (useDarkVariant ? builtOnFhenixDarkUrl : builtOnFhenixUrl)
    : (useDarkVariant ? builtOnNearDarkUrl : builtOnNearUrl);

  const altText = variant === "zcash" 
    ? "Built on Zcash" 
    : variant === "starknet"
    ? "Built on Starknet"
    : variant === "solana"
    ? "Built on Solana"
    : variant === "base"
    ? "Built on Base"
    : variant === "fhenix"
    ? "Built on Fhenix"
    : "Built on NEAR";

  // Zcash badge needs to be larger due to its wide aspect ratio
  // Solana, Base, and Fhenix need to be 25% smaller
  const isZcash = variant === "zcash";
  const needsSmaller = variant === "solana" || variant === "base" || variant === "fhenix";
  
  const badgeContent = isZcash ? (
    <img
      src={badgeSrc}
      alt={altText}
      className={cn("transition-transform hover:scale-105", className)}
      style={{ height: "44px", width: "auto", transform: "scale(1.2)", transformOrigin: "center" }}
    />
  ) : needsSmaller ? (
    <img
      src={badgeSrc}
      alt={altText}
      className={cn("h-6 w-auto transition-transform hover:scale-105 object-contain", className)}
      style={{ maxHeight: "24px", minHeight: "18px" }}
    />
  ) : (
    <img
      src={badgeSrc}
      alt={altText}
      className={cn("h-8 w-auto transition-transform hover:scale-105 object-contain", className)}
      style={{ maxHeight: "32px", minHeight: "24px" }}
    />
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center"
      >
        {badgeContent}
      </a>
    );
  }

  return <div className="inline-flex items-center">{badgeContent}</div>;
}

