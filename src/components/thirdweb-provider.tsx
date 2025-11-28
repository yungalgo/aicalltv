"use client";

import { ThirdwebProvider as TWProvider } from "thirdweb/react";

export function ThirdwebProvider({ children }: { children: React.ReactNode }) {
  return <TWProvider>{children}</TWProvider>;
}

