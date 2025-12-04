"use client";

import { motion, type Transition } from "motion/react";
import { useMemo } from "react";

interface ShimmeringTextProps extends React.HTMLAttributes<HTMLDivElement> {
  text: string;
  duration?: number;
  wave?: boolean;
  color?: string;
  shimmeringColor?: string;
  transition?: Transition;
  className?: string;
}

export function ShimmeringText({
  text,
  duration = 2,
  wave = false,
  color = "hsl(var(--muted-foreground))",
  shimmeringColor = "hsl(var(--foreground))",
  transition,
  className,
  ...props
}: ShimmeringTextProps) {
  const characters = useMemo(() => text.split(""), [text]);

  return (
    <div
      className={className}
      style={{ display: "inline-flex", flexWrap: "wrap" }}
      {...props}
    >
      {characters.map((char, index) => (
        <ShimmeringCharacter
          key={`${char}-${index}`}
          char={char}
          index={index}
          total={characters.length}
          duration={duration}
          wave={wave}
          color={color}
          shimmeringColor={shimmeringColor}
          transition={transition}
        />
      ))}
    </div>
  );
}

interface ShimmeringCharacterProps {
  char: string;
  index: number;
  total: number;
  duration: number;
  wave: boolean;
  color: string;
  shimmeringColor: string;
  transition?: Transition;
}

function ShimmeringCharacter({
  char,
  index,
  total,
  duration,
  wave,
  color,
  shimmeringColor,
  transition,
}: ShimmeringCharacterProps) {
  const delay = (index / total) * duration;

  const shimmerVariants = {
    initial: {
      color,
      ...(wave && {
        x: 0,
        y: 0,
        scale: 1,
        rotateZ: 0,
      }),
    },
    animate: {
      color: [color, shimmeringColor, color],
      ...(wave && {
        x: [0, 5, 0, -5, 0],
        y: [0, -3, 0, 3, 0],
        scale: [1, 1.1, 1, 1.05, 1],
        rotateZ: [0, 4, 0, -4, 0],
      }),
    },
  };

  const defaultTransition: Transition = {
    duration,
    repeat: Infinity,
    repeatType: "loop",
    ease: "easeInOut",
    delay,
  };

  return (
    <motion.span
      variants={shimmerVariants}
      initial="initial"
      animate="animate"
      transition={transition || defaultTransition}
      style={{
        display: "inline-block",
        whiteSpace: char === " " ? "pre" : "normal",
        willChange: "color, transform",
      }}
    >
      {char}
    </motion.span>
  );
}

