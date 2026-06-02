import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botsTable = pgTable("bots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  userCount: integer("user_count").notNull().default(0),
  iconEmoji: text("icon_emoji"),
  botUrl: text("bot_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBotSchema = createInsertSchema(botsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBot = z.infer<typeof insertBotSchema>;
export type Bot = typeof botsTable.$inferSelect;
