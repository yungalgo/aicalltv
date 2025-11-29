import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

import path from "node:path";

const nobleHashesShim = path.resolve(
  __dirname,
  "src/lib/shims/noble-hashes-crypto.ts",
);

// Plugin order matches official TanStack Start template
// https://tanstack.com/start/latest/docs/framework/react/guide/hosting
export default defineConfig({
  resolve: {
    alias: {
      // Fix @noble/hashes/crypto ESM subpath export issue
      // Some versions don't export ./crypto, so we provide a shim
      "@noble/hashes/crypto": nobleHashesShim,
    },
  },
  plugins: [
    devtools(),
    // Nitro without rollup plugin to avoid pg bundling issues
    nitro({
      alias: {
        "@noble/hashes/crypto": nobleHashesShim,
      },
    }),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact({
      babel: {
        plugins: [
          [
            "babel-plugin-react-compiler",
            {
              target: "19",
            },
          ],
        ],
      },
    }),
  ],
  server: {
    allowedHosts: [".ngrok-free.app", ".ngrok.io"],
  },
});
