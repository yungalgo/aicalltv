"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";

interface AnimatedButtonProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ children, className, icon, iconPosition = "left", style, onClick, disabled, type = "button" }, ref) => {
    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={disabled}
        onClick={onClick}
        style={style}
        whileHover={{ scale: disabled ? 1 : 1.03 }}
        whileTap={{ scale: disabled ? 1 : 0.97 }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 17,
        }}
        className={cn(
          "relative inline-flex items-center justify-center gap-2",
          className
        )}
      >
        {icon && iconPosition === "left" && (
          <motion.span
            animate={{ 
              rotate: [0, -10, 10, -10, 0],
            }}
            transition={{
              duration: 0.5,
              repeat: Infinity,
              repeatDelay: 2,
            }}
          >
            {icon}
          </motion.span>
        )}
        {children}
        {icon && iconPosition === "right" && (
          <motion.span
            animate={{ 
              rotate: [0, -10, 10, -10, 0],
            }}
            transition={{
              duration: 0.5,
              repeat: Infinity,
              repeatDelay: 2,
            }}
          >
            {icon}
          </motion.span>
        )}
      </motion.button>
    );
  }
);
AnimatedButton.displayName = "AnimatedButton";

