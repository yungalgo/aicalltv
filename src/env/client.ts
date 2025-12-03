import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_BASE_URL: z.url().default("http://localhost:3000"),
    // Fhenix PIIVault contract on Base mainnet
    VITE_PII_VAULT_ADDRESS: z
      .string()
      .default("0x7eD75e4ec7b3Df1b651654d7A7E89CeC0AcEf0a5"),
  },
  runtimeEnv: import.meta.env,
});
