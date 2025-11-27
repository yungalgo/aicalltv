import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Packages that rolldown-vite struggles to bundle - mark as external
// These will be loaded from node_modules at runtime
const nodeExternals = [
  "twilio",
  "pg-boss",
  "fluent-ffmpeg",
];

// https://tanstack.com/start/latest/docs/framework/react/guide/hosting
export default defineConfig({
  plugins: [
    devtools(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart(),
    nitro({
      // Configure Nitro to NOT bundle these packages
      rollupConfig: {
        external: nodeExternals,
      },
    }),
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
    tailwindcss(),
  ],
  server: {
    allowedHosts: [
      ".ngrok-free.app",
      ".ngrok.io",
    ],
  },
  // Mark these as external for SSR build
  ssr: {
    external: nodeExternals,
  },
  // Also mark for client build (shouldn't be needed but just in case)
  build: {
    rollupOptions: {
      external: nodeExternals,
    },
  },
});
