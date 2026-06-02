import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subagentApplicationsTable = pgTable("subagent_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  telegramId: text("telegram_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  company: text("company"),
  country: text("country").notNull().default(""),
  address: text("address").notNull().default(""),
  experience: text("experience").notNull(),
  motivation: text("motivation").notNull(),
  status: text("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSubagentApplicationSchema = createInsertSchema(subagentApplicationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
});
export type InsertSubagentApplication = z.infer<typeof insertSubagentApplicationSchema>;
export type SubagentApplication = typeof subagentApplicationsTable.$inferSelect;
