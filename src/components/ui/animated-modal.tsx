"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "~/lib/utils";
import { X } from "lucide-react";

interface ModalContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const ModalContext = React.createContext<ModalContextType | undefined>(undefined);

const useModal = () => {
  const context = React.useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a Modal");
  }
  return context;
};

interface ModalProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Modal({ children, defaultOpen = false, open: controlledOpen, onOpenChange }: ModalProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = React.useCallback((value: React.SetStateAction<boolean>) => {
    const newValue = typeof value === "function" ? value(open) : value;
    if (controlledOpen === undefined) {
      setUncontrolledOpen(newValue);
    }
    onOpenChange?.(newValue);
  }, [controlledOpen, open, onOpenChange]);

  return (
    <ModalContext.Provider value={{ open, setOpen }}>
      {children}
    </ModalContext.Provider>
  );
}

interface ModalTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  asChild?: boolean;
}

export const ModalTrigger = React.forwardRef<HTMLButtonElement, ModalTriggerProps>(
  ({ children, className, asChild, ...props }, ref) => {
    const { setOpen } = useModal();
    
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(true)}
        className={cn(
          "relative flex items-center justify-center rounded-md px-4 py-2 font-medium transition-colors",
          className
        )}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);
ModalTrigger.displayName = "ModalTrigger";

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
  closeOnOutsideClick?: boolean;
  showCloseButton?: boolean;
}

export function ModalBody({ 
  children, 
  className, 
  closeOnOutsideClick = true,
  showCloseButton = true 
}: ModalBodyProps) {
  const { open, setOpen } = useModal();
  const modalRef = React.useRef<HTMLDivElement>(null);

  // Lock body scroll when modal is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  // Handle outside click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnOutsideClick && e.target === e.currentTarget) {
      setOpen(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleBackdropClick}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          style={{ perspective: "1200px" }}
        >
          <motion.div
            ref={modalRef}
            initial={{ 
              opacity: 0, 
              scale: 0.95,
              rotateX: -10,
              y: 20
            }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              rotateX: 0,
              y: 0
            }}
            exit={{ 
              opacity: 0, 
              scale: 0.95,
              rotateX: 10,
              y: -20
            }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 300,
            }}
            className={cn(
              "relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900",
              className
            )}
            style={{ transformStyle: "preserve-3d" }}
          >
            {showCloseButton && (
              <button
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 rounded-full p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              >
                <X className="h-5 w-5" />
              </button>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ModalContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalContent({ children, className }: ModalContentProps) {
  return (
    <div className={cn("", className)}>
      {children}
    </div>
  );
}

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}

export function ModalFooter({ children, className, align = "right" }: ModalFooterProps) {
  return (
    <div 
      className={cn(
        "mt-6 flex",
        align === "left" && "justify-start",
        align === "center" && "justify-center",
        align === "right" && "justify-end",
        className
      )}
    >
      {children}
    </div>
  );
}

// Hook to control modal from outside
export function useModalState() {
  const [open, setOpen] = React.useState(false);
  return { open, setOpen, onOpenChange: setOpen };
}

