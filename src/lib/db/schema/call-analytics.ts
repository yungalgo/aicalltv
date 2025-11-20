import { date, integer, pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";

export const callAnalytics = pgTable("call_analytics", {
  id: uuid("id").defaultRandom().primaryKey(),
  phoneNumberHash: text("phone_number_hash").notNull(),
  date: date("date").notNull(), // YYYY-MM-DD format
  callCount: integer("call_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique().on(table.phoneNumberHash, table.date),
]);

