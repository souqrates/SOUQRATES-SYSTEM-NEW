import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // deposit | withdraw | transfer_in | transfer_out | commission | refund
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  currency: text("currency"), // TON | USDT
  txHash: text("tx_hash"),
  status: text("status").notNull().default("pending"), // pending | confirmed | failed
  note: text("note"),
  refUserId: integer("ref_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
