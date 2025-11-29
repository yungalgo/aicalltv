import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Plugin order matches official TanStack Start template
// https://tanstack.com/start/latest/docs/framework/react/guide/hosting
export default defineConfig({
  plugins: [
    devtools(),
    nitro({
      // Mark @noble packages as external - let Node.js resolve them at runtime
      // This avoids the ERR_PACKAGE_PATH_NOT_EXPORTED error
      externals: ["@noble/hashes", "@noble/curves", "@noble/ciphers"],
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
