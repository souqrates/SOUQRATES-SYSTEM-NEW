import { pgTable, text, serial, timestamp, boolean, integer, numeric, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const souqProductsTable = pgTable("souq_products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  category: text("category").notNull().default("book"), // book | template | course
  description: text("description").notNull().default(""),
  longDescription: text("long_description").notNull().default(""),
  author: text("author").notNull().default(""),
  coverImageUrl: text("cover_image_url").notNull().default(""),
  fileUrl: text("file_url").notNull().default(""),
  previewUrl: text("preview_url").notNull().default(""),
  price: numeric("price", { precision: 18, scale: 6 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  totalSales: integer("total_sales").notNull().default(0),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("0"),
  tags: text("tags").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const souqPurchasesTable = pgTable("souq_purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  productId: integer("product_id").notNull().references(() => souqProductsTable.id),
  pricePaid: numeric("price_paid", { precision: 18, scale: 6 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("souq_purchases_user_id_idx").on(table.userId),
  index("souq_purchases_product_id_idx").on(table.productId),
  unique("souq_purchases_user_product_unique").on(table.userId, table.productId),
]);

export const insertSouqProductSchema = createInsertSchema(souqProductsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSouqPurchaseSchema = createInsertSchema(souqPurchasesTable).omit({ id: true, createdAt: true });

export type SouqProduct = typeof souqProductsTable.$inferSelect;
export type SouqPurchase = typeof souqPurchasesTable.$inferSelect;
