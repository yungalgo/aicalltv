"use client";

import * as React from "react";
import { cn } from "~/lib/utils";

interface MessageProps extends React.ComponentProps<"div"> {
  from: "user" | "assistant";
}

const Message = React.forwardRef<HTMLDivElement, MessageProps>(
  ({ from, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex gap-3 items-center",
          from === "user" ? "flex-row-reverse" : "flex-row",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Message.displayName = "Message";

const MessageContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex-1 rounded-lg px-4 py-3", className)}
      {...props}
    >
      {children}
    </div>
  );
});
MessageContent.displayName = "MessageContent";

interface MessageAvatarProps extends React.ComponentProps<"div"> {
  name?: string;
  src?: string;
}

// Color swatch for user avatars
const USER_AVATAR_COLORS = ["#FFBE86", "#FFE156", "#FFE9CE", "#FFB5C2", "#3777FF"];

// Emoji pool for user avatars
const USER_EMOJIS = ["😀", "😊", "😎", "🤩", "😍", "🥳", "🤗", "😇", "🙂", "😋", "😌", "😏", "😄", "😃", "😁"];

// Generate consistent emoji and color based on name
function getUserAvatar(name: string) {
  // Create a simple hash from the name for consistency
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const emojiIndex = Math.abs(hash) % USER_EMOJIS.length;
  const colorIndex = Math.abs(hash) % USER_AVATAR_COLORS.length;
  
  return {
    emoji: USER_EMOJIS[emojiIndex],
    color: USER_AVATAR_COLORS[colorIndex],
  };
}

const MessageAvatar = React.forwardRef<HTMLDivElement, MessageAvatarProps>(
  ({ name, src, className, ...props }, ref) => {
    // If no src and name is "You" or user-related, generate emoji avatar
    const isUser = name === "You" || (!src && name);
    const avatarData = isUser && name ? getUserAvatar(name) : null;
    
    return (
      <div
        ref={ref}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          className || (isUser && avatarData ? "" : "bg-muted")
        )}
        style={isUser && avatarData ? { backgroundColor: avatarData.color } : undefined}
        {...props}
      >
        {src ? (
          <img src={src} alt={name || "Avatar"} className="h-8 w-8 object-contain" />
        ) : avatarData ? (
          <span className="text-lg">{avatarData.emoji}</span>
        ) : (
          <span className="text-xs font-medium">
            {name ? name.charAt(0).toUpperCase() : "?"}
          </span>
        )}
      </div>
    );
  }
);
MessageAvatar.displayName = "MessageAvatar";

export { Message, MessageContent, MessageAvatar };

