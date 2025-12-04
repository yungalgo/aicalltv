"use client";

import * as React from "react";
import { Button } from "~/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";

type ScrollBehavior = "smooth" | "auto" | "instant";

interface ConversationContextValue {
  isStuck: boolean;
  scrollToBottom: () => void;
}

const ConversationContext = React.createContext<ConversationContextValue | null>(null);

const useConversation = () => {
  const context = React.useContext(ConversationContext);
  if (!context) {
    throw new Error("useConversation must be used within Conversation");
  }
  return context;
};

interface ConversationProps extends React.ComponentProps<"div"> {
  initial?: ScrollBehavior;
  resize?: ScrollBehavior;
}

const Conversation = React.forwardRef<HTMLDivElement, ConversationProps>(
  ({ initial = "smooth", resize = "smooth", className, children, ...props }, ref) => {
    const [isStuck, setIsStuck] = React.useState(true);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when content changes
    React.useEffect(() => {
      if (!containerRef.current || !contentRef.current) return;
      
      const container = containerRef.current;
      const content = contentRef.current;
      
      const checkScroll = () => {
        const threshold = 50; // pixels from bottom
        const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
        setIsStuck(isNearBottom);
      };

      const observer = new MutationObserver(() => {
        checkScroll();
        if (isStuck) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: initial,
          });
        }
      });

      observer.observe(content, { childList: true, subtree: true });
      container.addEventListener("scroll", checkScroll);
      checkScroll();

      return () => {
        observer.disconnect();
        container.removeEventListener("scroll", checkScroll);
      };
    }, [initial, isStuck]);

    const scrollToBottom = React.useCallback(() => {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: initial,
        });
        setIsStuck(true);
      }
    }, [initial]);

    const contextValue = React.useMemo(
      () => ({ isStuck, scrollToBottom }),
      [isStuck, scrollToBottom]
    );

    return (
      <ConversationContext.Provider value={contextValue}>
        <div
          ref={(node) => {
            if (typeof ref === "function") {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
            containerRef.current = node;
          }}
          className={cn("relative overflow-y-auto scrollbar-hide", className)}
          {...props}
        >
          <div ref={contentRef}>
            {children}
          </div>
        </div>
      </ConversationContext.Provider>
    );
  }
);
Conversation.displayName = "Conversation";

const ConversationContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col gap-4 p-4", className)}
      {...props}
    />
  );
});
ConversationContent.displayName = "ConversationContent";

interface ConversationScrollButtonProps
  extends React.ComponentProps<typeof Button> {}

const ConversationScrollButton = React.forwardRef<
  React.ElementRef<typeof Button>,
  ConversationScrollButtonProps
>(({ className, ...props }, ref) => {
  const { isStuck, scrollToBottom } = useConversation();

  if (isStuck) return null;

  return (
    <Button
      ref={ref}
      variant="outline"
      size="icon"
      className={cn(
        "absolute bottom-4 right-4 rounded-full shadow-lg",
        className
      )}
      onClick={scrollToBottom}
      {...props}
    >
      <ChevronDown className="h-4 w-4" />
      <span className="sr-only">Scroll to bottom</span>
    </Button>
  );
});
ConversationScrollButton.displayName = "ConversationScrollButton";

export { Conversation, ConversationContent, ConversationScrollButton };

