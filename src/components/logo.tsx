import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logoIconUrl from "~/assets/logos/logo.svg";
import logoWithTextUrl from "~/assets/logos/logo-with-text.svg";
import logoTextOnlyUrl from "~/assets/logos/logo-text-only.svg";
import logoWithTextDarkUrl from "~/assets/logos/logo-with-text-dark-mode.svg";
import logoTextOnlyDarkUrl from "~/assets/logos/logo-text-only-dark-mode.svg";
import { cn } from "~/lib/utils";

type LogoVariant = "full" | "icon" | "text";

interface LogoProps {
  variant?: LogoVariant;
  className?: string;
  href?: string;
  onClick?: () => void;
  /** Force dark mode styling (for use on dark backgrounds) */
  forceDark?: boolean;
}

export function Logo({ variant = "full", className = "", href, onClick, forceDark }: LogoProps) {
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

  const getLogoSrc = () => {
    // Use forceDark if provided, otherwise use detected theme
    const isDarkMode = forceDark !== undefined ? forceDark : isDark;
    
    switch (variant) {
      case "icon":
        // Icon doesn't have a dark mode variant, use regular
        return logoIconUrl;
      case "text":
        return isDarkMode ? logoTextOnlyDarkUrl : logoTextOnlyUrl;
      case "full":
      default:
        return isDarkMode ? logoWithTextDarkUrl : logoWithTextUrl;
    }
  };

  const getLogoAlt = () => {
    switch (variant) {
      case "icon":
        return "aicall.tv";
      case "text":
        return "aicall.tv";
      case "full":
      default:
        return "aicall.tv";
    }
  };

  const getLogoClassName = () => {
    switch (variant) {
      case "icon":
        return cn("h-8 w-8", className);
      case "text":
        return cn("h-6 w-auto", className);
      case "full":
      default:
        return cn("h-8 w-auto", className);
    }
  };

  const logoContent = (
    <img
      src={getLogoSrc()}
      alt={getLogoAlt()}
      className={getLogoClassName()}
    />
  );

  if (href) {
    return (
      <Link to={href} className="inline-flex items-center" onClick={onClick}>
        {logoContent}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        className="inline-flex items-center focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm"
        onClick={onClick}
      >
        {logoContent}
      </button>
    );
  }

  return <div className="inline-flex items-center">{logoContent}</div>;
}

// Pulsing logo spinner for loading states
interface LogoSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  /** If true, positions fixed in center of viewport */
  fixed?: boolean;
}

// Animated dots component
function AnimatedDots() {
  return (
    <span className="inline-flex">
      <span className="animate-[bounce_1s_ease-in-out_infinite]">.</span>
      <span className="animate-[bounce_1s_ease-in-out_0.2s_infinite]">.</span>
      <span className="animate-[bounce_1s_ease-in-out_0.4s_infinite]">.</span>
    </span>
  );
}

export function LogoSpinner({ size = "md", className = "", fixed = false }: LogoSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-12 h-12",
    lg: "w-[72px] h-[72px]",
  };

  const spinner = (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <img 
        src={logoIconUrl} 
        alt="Loading..." 
        className={cn(sizeClasses[size], "animate-[pulse-scale_1.5s_ease-in-out_infinite]")}
        style={{
          animation: "pulse-scale 1.5s ease-in-out infinite",
        }}
      />
      <p className="text-[#1A1A1A] font-semibold text-lg">
        Loading<AnimatedDots />
      </p>
    </div>
  );

  // Add the keyframes style
  const keyframesStyle = `
    @keyframes pulse-scale {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }
  `;

  if (fixed) {
    return (
      <>
        <style>{keyframesStyle}</style>
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-6 p-8 rounded-2xl border-2" style={{ backgroundColor: '#fffcf2', borderColor: '#1A1A1A' }}>
            {spinner}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{keyframesStyle}</style>
      {spinner}
    </>
  );
}

