import { pgTable, text, serial, timestamp, numeric, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: text("type").notNull(), // deposit | withdraw | transfer_in | transfer_out | commission | refund
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  currency: text("currency"), // TON | USDT
  txHash: text("tx_hash"),
  status: text("status").notNull().default("pending"), // pending | confirmed | failed
  note: text("note"),
  refUserId: integer("ref_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("transactions_user_id_idx").on(table.userId),
  index("transactions_type_idx").on(table.type),
  index("transactions_user_created_idx").on(table.userId, table.createdAt),
]);

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
