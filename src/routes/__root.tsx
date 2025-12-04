/// <reference types="vite/client" />
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { authQueryOptions, type AuthQueryResult } from "~/lib/auth/queries";
import appCss from "~/styles.css?url";

import { ThemeProvider } from "~/components/theme-provider";
import { Toaster } from "~/components/ui/sonner";
import { WarpedNoiseShaders } from "~/components/ui/warped-noise-shaders";
import { LogoSpinner } from "~/components/logo";

// Lazy load Web3Provider to avoid SSR bundling issues
const Web3Provider = lazy(() =>
  import("~/components/web3-provider").then((mod) => ({
    default: mod.Web3Provider,
  })),
);

// Lazy load SolanaProvider for Solana wallet-ui
const SolanaProvider = lazy(() =>
  import("~/components/solana/solana-provider").then((mod) => ({
    default: mod.SolanaProvider,
  })),
);

// Lazy load StarknetProvider for Ztarknet privacy-preserving payments
const StarknetProvider = lazy(() =>
  import("~/components/starknet-provider").then((mod) => ({
    default: mod.StarknetProvider,
  })),
);

// Note: Workers are initialized separately via `bun run worker` command
// This avoids bundling server-only dependencies (pg-boss, etc.) into the client

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user: AuthQueryResult;
}>()({
  beforeLoad: ({ context }) => {
    // we're using react-query for client-side caching to reduce client-to-server calls, see /src/router.tsx
    // better-auth's cookieCache is also enabled server-side to reduce server-to-db calls, see /src/lib/auth/auth.ts
    context.queryClient.prefetchQuery(authQueryOptions());

    // typically we don't need the user immediately in landing pages,
    // so we're only prefetching here and not awaiting.
    // for protected routes with loader data, see /(authenticated)/route.tsx
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "aicall.tv | prank call your friends with ai and get a video instantly",
      },
      {
        name: "description",
        content: "prank call your friends with ai and get a video instantly. choose from unique ai caller personalities, pay per call, share the laughs!",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

// Loading spinner component shown over shader
function LoadingSpinner() {
  return <LogoSpinner fixed size="lg" />;
}

function RootDocument({ children }: { readonly children: React.ReactNode }) {
  return (
    // suppress since we're updating the "dark" class in ThemeProvider
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="relative">
        {/* Warped noise shader background - always visible, outside Suspense */}
        <div className="fixed inset-0 z-0" style={{ willChange: 'transform', transform: 'translateZ(0)', isolation: 'isolate' }}>
          <WarpedNoiseShaders
            speed={0.4}
            scale={1.0}
            warpStrength={1.2}
            colorIntensity={0.8}
            noiseDetail={1.5}
            className="h-full w-full"
          />
        </div>

        <Suspense fallback={<LoadingSpinner />}>
          <Web3Provider>
            <SolanaProvider>
              <StarknetProvider>
              <ThemeProvider>
                {/* Main content - positioned above background */}
                <div className="relative z-10">
                  {children}
                </div>
                <Toaster richColors />
              </ThemeProvider>
              </StarknetProvider>
            </SolanaProvider>
          </Web3Provider>
        </Suspense>

        <TanStackDevtools
          plugins={[
            {
              name: "TanStack Query",
              render: <ReactQueryDevtoolsPanel />,
            },
            {
              name: "TanStack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />

        <Scripts />
      </body>
    </html>
  );
}
