import { pgTable, serial, timestamp, boolean, numeric, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  skzPerTon: numeric("skz_per_ton", { precision: 18, scale: 6 }).notNull().default("100"),
  skzPerUsdt: numeric("skz_per_usdt", { precision: 18, scale: 6 }).notNull().default("10"),
  level1Rate: numeric("level1_rate", { precision: 5, scale: 2 }).notNull().default("10"),
  level2Rate: numeric("level2_rate", { precision: 5, scale: 2 }).notNull().default("5"),
  level3Rate: numeric("level3_rate", { precision: 5, scale: 2 }).notNull().default("2"),
  minDeposit: numeric("min_deposit", { precision: 18, scale: 6 }).notNull().default("1"),
  maxWithdraw: numeric("max_withdraw", { precision: 18, scale: 6 }).notNull().default("10000"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  maintenanceMsg: text("maintenance_msg"),
  botToken: text("bot_token"),
  welcomeMessage: text("welcome_message"),
  // Bot tokens (stored in DB as fallback to env vars)
  systemBotToken:   text("system_bot_token"),
  subagentBotToken: text("subagent_bot_token"),
  skillzBotToken:   text("skillz_bot_token"),
  souqBotToken:     text("souq_bot_token"),
  // Infrastructure / integrations
  sentryDsn: text("sentry_dsn"),
  upstashRedisUrl: text("upstash_redis_url"),
  upstashRedisToken: text("upstash_redis_token"),
  upstashQstashUrl: text("upstash_qstash_url"),
  upstashQstashToken: text("upstash_qstash_token"),
  contaboWebhookUrl: text("contabo_webhook_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true, updatedAt: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
