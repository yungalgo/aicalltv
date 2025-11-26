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
  "web3_wallet",
]);

export const videoStatusEnum = pgEnum("video_status", [
  "pending",
  "generating",
  "completed",
  "failed",
]);

