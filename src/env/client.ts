import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_BASE_URL: z.url().default("http://localhost:3000"),
    // Fhenix PIIVault v2 contract on Base mainnet (with decryption support)
    VITE_PII_VAULT_ADDRESS: z
      .string()
      .default("0xc6d16980078e5613EDCe9B332d1F25810e57d9CB"),
  },
  runtimeEnv: import.meta.env,
});
