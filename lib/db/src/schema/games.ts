import { pgTable, text, serial, timestamp, boolean, integer, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const skillzGamesTable = pgTable("skillz_games", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  totalPlays: integer("total_plays").notNull().default(0),
  difficultyLabel: text("difficulty_label"),
  tags: text("tags"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const gameTicketsTable = pgTable("game_tickets", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => skillzGamesTable.id),
  tier: integer("tier").notNull(),
  name: text("name").notNull(),
  entryPrice: numeric("entry_price", { precision: 18, scale: 6 }).notNull().default("10"),
  prize: numeric("prize", { precision: 18, scale: 6 }).notNull().default("50"),
  targetScore: integer("target_score").notNull().default(100),
  timeLimitSeconds: integer("time_limit_seconds").notNull().default(60),
  correctHitValue: integer("correct_hit_value").notNull().default(10),
  wrongHitPenalty: integer("wrong_hit_penalty").notNull().default(5),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("game_tickets_game_id_idx").on(table.gameId),
]);

export const gameSessionsTable = pgTable("game_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  gameId: integer("game_id").notNull().references(() => skillzGamesTable.id),
  ticketId: integer("ticket_id").notNull().references(() => gameTicketsTable.id),
  status: text("status").notNull().default("active"),
  score: integer("score").notNull().default(0),
  // Server-authoritative scoring state. Score is tallied from validated hit
  // events; combo persists the streak multiplier; lastEventAt rate-limits events.
  combo: integer("combo").notNull().default(0),
  lastEventAt: timestamp("last_event_at", { withTimezone: true }),
  entryPrice: numeric("entry_price", { precision: 18, scale: 6 }).notNull(),
  prize: numeric("prize", { precision: 18, scale: 6 }).notNull(),
  targetScore: integer("target_score").notNull(),
  timeLimitSeconds: integer("time_limit_seconds").notNull(),
  correctHitValue: integer("correct_hit_value").notNull(),
  wrongHitPenalty: integer("wrong_hit_penalty").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
}, (table) => [
  index("game_sessions_user_id_idx").on(table.userId),
  index("game_sessions_game_id_idx").on(table.gameId),
  index("game_sessions_status_idx").on(table.status),
]);

export const insertGameSchema = createInsertSchema(skillzGamesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTicketSchema = createInsertSchema(gameTicketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSessionSchema = createInsertSchema(gameSessionsTable).omit({ id: true });

export type SkillzGame = typeof skillzGamesTable.$inferSelect;
export type GameTicket = typeof gameTicketsTable.$inferSelect;
export type GameSession = typeof gameSessionsTable.$inferSelect;
