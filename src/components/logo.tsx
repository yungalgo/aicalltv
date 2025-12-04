import { Link } from "@tanstack/react-router";
import logoIconUrl from "./logo.svg";
import logoWithTextUrl from "./logo-with-text.svg";
import logoTextOnlyUrl from "./logo-text-only.svg";
import { cn } from "~/lib/utils";

type LogoVariant = "full" | "icon" | "text";

interface LogoProps {
  variant?: LogoVariant;
  className?: string;
  href?: string;
  onClick?: () => void;
}

export function Logo({ variant = "full", className = "", href, onClick }: LogoProps) {
  const getLogoSrc = () => {
    switch (variant) {
      case "icon":
        return logoIconUrl;
      case "text":
        return logoTextOnlyUrl;
      case "full":
      default:
        return logoWithTextUrl;
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

