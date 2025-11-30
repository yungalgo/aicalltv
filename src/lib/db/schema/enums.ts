import { pgEnum } from "drizzle-orm/pg-core";

export const callStatusEnum = pgEnum("call_status", [
  "call_created",
  "prompt_ready",
  "call_attempted",
  "call_complete",
  "call_failed",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "free",
  "near_ai",
  "sol",
  "mina",
  "zcash",
  "ztarknet",
  "web3_wallet",
  "stripe",
]);

export const creditStateEnum = pgEnum("credit_state", [
  "unused",    // Credit is available to use
  "consumed",  // Credit has been used for a call
  "expired",   // Credit expired or was refunded
]);

export const videoStatusEnum = pgEnum("video_status", [
  "pending",
  "generating",
  "completed",
  "failed",
]);

