import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const callers = pgTable("callers", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  personality: text("personality").notNull(),
  speakingStyle: text("speaking_style").notNull(),
  voiceId: text("voice_id").notNull(),
  voiceName: text("voice_name").notNull(),
  gender: text("gender").notNull(), // "male", "female", "non-binary"
  defaultImageUrl: text("default_image_url").notNull(),
  defaultImageS3Key: text("default_image_s3_key").notNull(),
  // Web-optimized WebP version for frontend display (PNG kept for model usage)
  webOptimizedImageUrl: text("web_optimized_image_url"),
  webOptimizedImageS3Key: text("web_optimized_image_s3_key"),
  appearanceDescription: text("appearance_description").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

