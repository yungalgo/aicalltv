"use client";

import * as React from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

interface PromptInputProps extends React.ComponentProps<"form"> {}

const PromptInput = React.forwardRef<HTMLFormElement, PromptInputProps>(
  ({ className, onSubmit, children, ...props }, ref) => {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      onSubmit?.(e);
    };

    return (
      <form
        ref={ref}
        onSubmit={handleSubmit}
        className={cn("flex gap-2 items-center", className)}
        {...props}
      >
        {children}
      </form>
    );
  }
);
PromptInput.displayName = "PromptInput";

const PromptInputTextarea = React.forwardRef<
  React.ElementRef<typeof Textarea>,
  React.ComponentProps<typeof Textarea>
>(({ className, ...props }, ref) => {
  return (
    <Textarea
      ref={ref}
      className={cn("min-h-[40px] max-h-[40px] resize-none py-2", className)}
      {...props}
    />
  );
});
PromptInputTextarea.displayName = "PromptInputTextarea";

interface PromptInputSubmitProps
  extends React.ComponentProps<typeof Button> {
  status?: "idle" | "loading" | "error";
}

const PromptInputSubmit = React.forwardRef<
  React.ElementRef<typeof Button>,
  PromptInputSubmitProps
>(({ status = "idle", className, disabled, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      type="submit"
      size="icon"
      disabled={disabled || status === "loading"}
      className={cn("shrink-0", className)}
      {...props}
    >
      {status === "loading" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      <span className="sr-only">Send message</span>
    </Button>
  );
});
PromptInputSubmit.displayName = "PromptInputSubmit";

export { PromptInput, PromptInputTextarea, PromptInputSubmit };

