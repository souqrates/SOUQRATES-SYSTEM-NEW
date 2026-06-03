import { pgTable, text, serial, timestamp, boolean, numeric, integer, index, check, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  photoUrl: text("photo_url"),
  skzBalance: numeric("skz_balance", { precision: 18, scale: 6 }).notNull().default("0"),
  referralCode: text("referral_code").notNull().unique(),
  referredBy: integer("referred_by").references((): AnyPgColumn => usersTable.id),
  isAdmin: boolean("is_admin").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),
  banReason: text("ban_reason"),
  totalEarned: numeric("total_earned", { precision: 18, scale: 6 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("users_referred_by_idx").on(table.referredBy),
  check("users_skz_balance_non_negative", sql`${table.skzBalance} >= 0`),
  check("users_total_earned_non_negative", sql`${table.totalEarned} >= 0`),
]);

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
