"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const statusVariants = cva(
  "inline-flex items-center gap-2 rounded-full transition-colors",
  {
    variants: {
      variant: {
        default: "bg-background",
        outline: "border border-border bg-transparent",
        filled: "",
      },
      status: {
        online: "",
        offline: "",
        busy: "",
        away: "",
      },
      size: {
        sm: "px-2 py-1 text-xs",
        md: "px-3 py-1.5 text-sm",
        lg: "px-4 py-2 text-base",
      },
    },
    compoundVariants: [
      {
        variant: "filled",
        status: "online",
        className: "bg-green-500/10 text-green-600",
      },
      {
        variant: "filled",
        status: "offline",
        className: "bg-red-500/10 text-red-600",
      },
      {
        variant: "filled",
        status: "busy",
        className: "bg-yellow-500/10 text-yellow-600",
      },
      {
        variant: "filled",
        status: "away",
        className: "bg-gray-500/10 text-gray-600",
      },
    ],
    defaultVariants: {
      variant: "default",
      status: "online",
      size: "md",
    },
  }
);

const indicatorVariants = cva(
  "relative flex h-2 w-2 shrink-0",
  {
    variants: {
      status: {
        online: "",
        offline: "",
        busy: "",
        away: "",
      },
      ping: {
        true: "",
        false: "",
      },
    },
    defaultVariants: {
      status: "online",
      ping: true,
    },
  }
);

const statusColors = {
  online: "bg-green-500",
  offline: "bg-red-500",
  busy: "bg-yellow-500",
  away: "bg-gray-500",
};

interface StatusContextValue {
  status: "online" | "offline" | "busy" | "away";
}

const StatusContext = React.createContext<StatusContextValue>({
  status: "online",
});

interface StatusProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusVariants> {
  status?: "online" | "offline" | "busy" | "away";
}

const Status = React.forwardRef<HTMLDivElement, StatusProps>(
  ({ className, variant, status = "online", size, children, ...props }, ref) => {
    return (
      <StatusContext.Provider value={{ status }}>
        <div
          ref={ref}
          className={cn(statusVariants({ variant, status, size }), className)}
          {...props}
        >
          {children}
        </div>
      </StatusContext.Provider>
    );
  }
);
Status.displayName = "Status";

interface StatusIndicatorProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof indicatorVariants> {
  ping?: boolean;
}

const StatusIndicator = React.forwardRef<HTMLSpanElement, StatusIndicatorProps>(
  ({ className, ping = true, ...props }, ref) => {
    const { status } = React.useContext(StatusContext);
    const colorClass = statusColors[status];

    return (
      <span
        ref={ref}
        className={cn(indicatorVariants({ status, ping }), className)}
        {...props}
      >
        {ping && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              colorClass
            )}
          />
        )}
        <span
          className={cn("relative inline-flex h-2 w-2 rounded-full", colorClass)}
        />
      </span>
    );
  }
);
StatusIndicator.displayName = "StatusIndicator";

interface StatusLabelProps extends React.HTMLAttributes<HTMLSpanElement> {}

const StatusLabel = React.forwardRef<HTMLSpanElement, StatusLabelProps>(
  ({ className, ...props }, ref) => {
    return <span ref={ref} className={cn("", className)} {...props} />;
  }
);
StatusLabel.displayName = "StatusLabel";

export { Status, StatusIndicator, StatusLabel, statusVariants, indicatorVariants };

