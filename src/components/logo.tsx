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
}

export function Logo({ variant = "full", className = "", href, onClick }: LogoProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
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
  }, []);

  const getLogoSrc = () => {
    const isDarkMode = isDark;
    
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
        return "AI Call TV";
      case "text":
        return "AI Call TV";
      case "full":
      default:
        return "AI Call TV";
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

