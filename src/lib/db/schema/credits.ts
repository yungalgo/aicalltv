import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth.schema";
import { calls } from "./calls";
import { creditStateEnum, paymentMethodEnum } from "./enums";

/**
 * Call Credits - the core of our payment security
 * 
 * Rule: Only the backend decides if a user has paid.
 * 
 * Flow:
 * 1. Payment happens → backend creates credit with state="unused"
 * 2. User creates call → backend finds unused credit, marks it "consumed"
 * 3. One credit = one call, can't be reused
 */
export const callCredits = pgTable("call_credits", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  // Who owns this credit
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  
  // Credit state - the key to security
  state: creditStateEnum("state").notNull().default("unused"),
  
  // How they paid
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  
  // External reference (tx hash for crypto, order ID for Lemon Squeezy)
  // Used to prevent replay attacks - same payment can't create multiple credits
  paymentRef: text("payment_ref"),
  
  // Network/chain (e.g., "base", "solana", "lemon_squeezy")
  network: text("network"),
  
  // Amount in USD cents (e.g., 500 = $5.00)
  amountCents: integer("amount_cents").notNull(),
  
  // Which call consumed this credit (set when state changes to "consumed")
  callId: uuid("call_id").references(() => calls.id),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  consumedAt: timestamp("consumed_at"),
}, (table) => ({
  // SECURITY: Unique constraint prevents duplicate credits from same payment
  // Even if race condition occurs, DB will reject the duplicate
  uniquePaymentRef: uniqueIndex("unique_payment_ref").on(table.paymentRef).where(sql`${table.paymentRef} IS NOT NULL`),
}));

