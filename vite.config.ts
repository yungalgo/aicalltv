import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Packages that rolldown-vite can't bundle - they'll be resolved from node_modules at runtime
const nodeExternals = [
  "twilio",
  "pg-boss",
  "fluent-ffmpeg",
];

export default defineConfig({
  plugins: [
    devtools(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart(),
    // https://tanstack.com/start/latest/docs/framework/react/guide/hosting
    nitro({
      // Tell Nitro to NOT bundle these - resolve from node_modules at runtime
      externals: {
        external: nodeExternals,
      },
    }),
    viteReact({
      // https://react.dev/learn/react-compiler
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
  // Tell Vite SSR build to skip these packages
  ssr: {
    external: nodeExternals,
  },
});
