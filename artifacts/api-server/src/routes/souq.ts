import { Router } from "express";
import { db, souqProductsTable, souqPurchasesTable, usersTable } from "@workspace/db";
import { eq, and, ilike, or, sql, desc } from "drizzle-orm";
import { processReferralCommissions, getSettings } from "../lib/referralCommissions";
import {
  ListSouqProductsQueryParams,
  CreateSouqProductBody,
  UpdateSouqProductBody,
  PurchaseSouqProductBody,
  GetMySouqLibraryQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/products", async (req, res) => {
  const parsed = ListSouqProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const { category, isActive, search, featured } = parsed.data;

  let query = db.select().from(souqProductsTable).$dynamic();

  const conditions = [];
  if (category) conditions.push(eq(souqProductsTable.category, category));
  if (isActive !== undefined) conditions.push(eq(souqProductsTable.isActive, isActive));
  if (featured) conditions.push(eq(souqProductsTable.isFeatured, true));
  if (search) {
    conditions.push(
      or(
        ilike(souqProductsTable.name, `%${search}%`),
        ilike(souqProductsTable.description, `%${search}%`),
        ilike(souqProductsTable.author, `%${search}%`)
      )!
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const products = await query.orderBy(desc(souqProductsTable.isFeatured), desc(souqProductsTable.createdAt));

  res.json(products.map(formatProduct));
});

router.post("/products", async (req, res) => {
  const parsed = CreateSouqProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const data = parsed.data;
  const [product] = await db.insert(souqProductsTable).values({
    name: data.name,
    slug: data.slug,
    category: data.category as "book" | "template" | "course",
    description: data.description,
    longDescription: data.longDescription ?? "",
    author: data.author,
    coverImageUrl: data.coverImageUrl ?? "",
    fileUrl: data.fileUrl ?? "",
    previewUrl: data.previewUrl ?? "",
    price: String(data.price),
    isActive: data.isActive ?? true,
    isFeatured: data.isFeatured ?? false,
    tags: data.tags ?? "",
  }).returning();

  res.status(201).json(formatProduct(product));
});

router.get("/products/:productId", async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }

  const [product] = await db.select().from(souqProductsTable).where(eq(souqProductsTable.id, productId));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(formatProduct(product));
});

router.patch("/products/:productId", async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }

  const parsed = UpdateSouqProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const data = parsed.data;
  const updateFields: Record<string, unknown> = {};
  if (data.name !== undefined) updateFields.name = data.name;
  if (data.slug !== undefined) updateFields.slug = data.slug;
  if (data.category !== undefined) updateFields.category = data.category;
  if (data.description !== undefined) updateFields.description = data.description;
  if (data.longDescription !== undefined) updateFields.longDescription = data.longDescription;
  if (data.author !== undefined) updateFields.author = data.author;
  if (data.coverImageUrl !== undefined) updateFields.coverImageUrl = data.coverImageUrl;
  if (data.fileUrl !== undefined) updateFields.fileUrl = data.fileUrl;
  if (data.previewUrl !== undefined) updateFields.previewUrl = data.previewUrl;
  if (data.price !== undefined) updateFields.price = String(data.price);
  if (data.isActive !== undefined) updateFields.isActive = data.isActive;
  if (data.isFeatured !== undefined) updateFields.isFeatured = data.isFeatured;
  if (data.tags !== undefined) updateFields.tags = data.tags;
  updateFields.updatedAt = new Date();

  const [updated] = await db
    .update(souqProductsTable)
    .set(updateFields)
    .where(eq(souqProductsTable.id, productId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(formatProduct(updated));
});

router.delete("/products/:productId", async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }

  await db.delete(souqProductsTable).where(eq(souqProductsTable.id, productId));
  res.json({ success: true });
});

router.post("/purchase/:productId", async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }

  const parsed = PurchaseSouqProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { telegramId } = parsed.data;

  const [product] = await db.select().from(souqProductsTable).where(and(eq(souqProductsTable.id, productId), eq(souqProductsTable.isActive, true)));
  if (!product) {
    res.status(404).json({ error: "Product not found or unavailable" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const price = parseFloat(product.price);
  const balance = parseFloat(user.skzBalance);

  if (balance < price) {
    res.status(400).json({ error: "Insufficient SKZ balance" });
    return;
  }

  const alreadyPurchased = await db.select({ id: souqPurchasesTable.id })
    .from(souqPurchasesTable)
    .where(and(eq(souqPurchasesTable.userId, user.id), eq(souqPurchasesTable.productId, productId)));

  if (alreadyPurchased.length > 0) {
    res.status(400).json({ error: "Already purchased" });
    return;
  }

  const newBalance = balance - price;

  await db.update(usersTable).set({ skzBalance: String(newBalance) }).where(eq(usersTable.id, user.id));

  const [purchase] = await db.insert(souqPurchasesTable).values({
    userId: user.id,
    productId,
    pricePaid: String(price),
  }).returning();

  await db.update(souqProductsTable)
    .set({ totalSales: product.totalSales + 1 })
    .where(eq(souqProductsTable.id, productId));

  // Process referral commissions on book purchase
  try {
    const settings = await getSettings();
    await processReferralCommissions(user.id, price, settings, `book purchase #${productId}`);
  } catch (commErr) {
    req.log.error({ commErr }, "Failed to process referral commissions for purchase");
  }

  res.json({
    success: true,
    purchaseId: purchase.id,
    productId,
    pricePaid: price,
    newBalance,
    fileUrl: product.fileUrl,
  });
});

router.get("/my-library", async (req, res) => {
  const parsed = GetMySouqLibraryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const { telegram_id } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegram_id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const library = await db
    .select({
      purchaseId: souqPurchasesTable.id,
      pricePaid: souqPurchasesTable.pricePaid,
      purchasedAt: souqPurchasesTable.createdAt,
      product: souqProductsTable,
    })
    .from(souqPurchasesTable)
    .innerJoin(souqProductsTable, eq(souqPurchasesTable.productId, souqProductsTable.id))
    .where(eq(souqPurchasesTable.userId, user.id))
    .orderBy(desc(souqPurchasesTable.createdAt));

  res.json(library.map((item) => ({
    purchaseId: item.purchaseId,
    pricePaid: parseFloat(item.pricePaid),
    purchasedAt: item.purchasedAt.toISOString(),
    product: formatProduct(item.product),
  })));
});

router.get("/stats", async (req, res) => {
  const [totals] = await db.select({
    totalProducts: sql<number>`count(*)::int`,
    activeProducts: sql<number>`count(*) filter (where ${souqProductsTable.isActive} = true)::int`,
    featuredProducts: sql<number>`count(*) filter (where ${souqProductsTable.isFeatured} = true)::int`,
  }).from(souqProductsTable);

  const [purchaseTotals] = await db.select({
    totalPurchases: sql<number>`count(*)::int`,
    totalRevenue: sql<number>`coalesce(sum(${souqPurchasesTable.pricePaid}::numeric), 0)::float`,
  }).from(souqPurchasesTable);

  const topProducts = await db.select({ name: souqProductsTable.name })
    .from(souqProductsTable)
    .orderBy(desc(souqProductsTable.totalSales))
    .limit(1);

  res.json({
    totalProducts: totals.totalProducts ?? 0,
    activeProducts: totals.activeProducts ?? 0,
    featuredProducts: totals.featuredProducts ?? 0,
    totalPurchases: purchaseTotals.totalPurchases ?? 0,
    totalRevenue: purchaseTotals.totalRevenue ?? 0,
    topProduct: topProducts[0]?.name ?? null,
  });
});

function formatProduct(p: typeof souqProductsTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: p.category,
    description: p.description,
    longDescription: p.longDescription,
    author: p.author,
    coverImageUrl: p.coverImageUrl,
    fileUrl: p.fileUrl,
    previewUrl: p.previewUrl,
    price: parseFloat(p.price),
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    totalSales: p.totalSales,
    rating: parseFloat(p.rating),
    tags: p.tags,
    createdAt: p.createdAt.toISOString(),
  };
}

export default router;
