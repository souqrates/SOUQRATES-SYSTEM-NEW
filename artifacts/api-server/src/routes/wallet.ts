import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, transactionsTable, settingsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { processReferralCommissions } from "../lib/referralCommissions";
import { requireAuth } from "../lib/auth";
import { DepositWalletBody, TransferSkzBody, ListTransactionsQueryParams } from "@workspace/api-zod";

const router = Router();

/** Thrown inside a transaction when the sender lacks sufficient balance. */
class InsufficientFundsError extends Error {}

function serializeTx(t: typeof transactionsTable.$inferSelect) {
  return {
    id: t.id,
    userId: t.userId,
    type: t.type,
    amount: parseFloat(t.amount),
    currency: t.currency,
    txHash: t.txHash,
    status: t.status,
    note: t.note,
    refUserId: t.refUserId,
    createdAt: t.createdAt.toISOString(),
  };
}

// GET /api/wallet/balance
router.get("/balance", requireAuth, async (req, res) => {
  // Actor is derived from the authenticated identity, never the client query.
  const telegram_id = req.auth!.telegramId;
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegram_id)).limit(1);
    if (users.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = users[0];

    const pendingResult = await db
      .select({ sum: sql<number>`coalesce(sum(amount), 0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.userId, user.id), eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "pending")));

    const depositedResult = await db
      .select({ sum: sql<number>`coalesce(sum(amount), 0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.userId, user.id), eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "confirmed")));

    const withdrawnResult = await db
      .select({ sum: sql<number>`coalesce(sum(amount), 0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.userId, user.id), eq(transactionsTable.type, "withdraw"), eq(transactionsTable.status, "confirmed")));

    res.json({
      telegramId: telegram_id,
      skzBalance: parseFloat(user.skzBalance),
      pendingDeposits: Number(pendingResult[0].sum),
      totalDeposited: Number(depositedResult[0].sum),
      totalWithdrawn: Number(withdrawnResult[0].sum),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching balance");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/wallet/deposit
router.post("/deposit", requireAuth, async (req, res) => {
  const parsed = DepositWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const { amount, currency, txHash, network } = parsed.data;
  // Actor is derived from the authenticated identity, never the client body.
  const telegramId = req.auth!.telegramId;

  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);
    if (users.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = users[0];

    const inserted = await db.transaction(async (tx) => {
      // Get conversion rate
      const settings = await tx.select().from(settingsTable).limit(1);
      const rate = settings.length > 0
        ? (currency === "TON" ? parseFloat(settings[0].skzPerTon) : parseFloat(settings[0].skzPerUsdt))
        : 100;
      const skzAmount = amount * rate;

      const [txRow] = await tx.insert(transactionsTable).values({
        userId: user.id,
        type: "deposit",
        amount: skzAmount.toString(),
        currency,
        txHash,
        status: "confirmed",
        note: `Deposit ${amount} ${currency} via ${network ?? "blockchain"}`,
      }).returning();

      // Credit balance
      await tx.update(usersTable)
        .set({ skzBalance: sql`${usersTable.skzBalance} + ${skzAmount}` })
        .where(eq(usersTable.id, user.id));

      // Process referral commissions in the same transaction
      await processReferralCommissions(tx, user.id, skzAmount, settings.length > 0 ? settings[0] : null);

      return txRow;
    });

    res.json(serializeTx(inserted));
  } catch (err) {
    req.log.error({ err }, "Error processing deposit");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/wallet/transfer
router.post("/transfer", requireAuth, async (req, res) => {
  const parsed = TransferSkzBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const { toTelegramId, amount, note } = parsed.data;
  // Sender is always the authenticated user, never taken from the client body.
  const fromTelegramId = req.auth!.telegramId;

  if (amount <= 0) {
    res.status(400).json({ error: "Amount must be positive" });
    return;
  }
  if (fromTelegramId === toTelegramId) {
    res.status(400).json({ error: "Cannot transfer to yourself" });
    return;
  }

  try {
    const [fromUsers, toUsers] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.telegramId, fromTelegramId)).limit(1),
      db.select().from(usersTable).where(eq(usersTable.telegramId, toTelegramId)).limit(1),
    ]);
    if (fromUsers.length === 0) { res.status(404).json({ error: "Sender not found" }); return; }
    if (toUsers.length === 0) { res.status(404).json({ error: "Recipient not found" }); return; }

    const from = fromUsers[0];
    const to = toUsers[0];

    const txOut = await db.transaction(async (tx) => {
      // Atomic debit: only succeeds if the sender still has the funds. This
      // conditional update is the guard against concurrent double-spends.
      const debited = await tx
        .update(usersTable)
        .set({ skzBalance: sql`${usersTable.skzBalance} - ${amount}` })
        .where(and(eq(usersTable.id, from.id), sql`${usersTable.skzBalance} >= ${amount}`))
        .returning({ id: usersTable.id });
      if (debited.length === 0) throw new InsufficientFundsError();

      // Credit receiver
      await tx.update(usersTable).set({ skzBalance: sql`${usersTable.skzBalance} + ${amount}` }).where(eq(usersTable.id, to.id));

      const [out] = await tx.insert(transactionsTable).values({ userId: from.id, type: "transfer_out", amount: amount.toString(), status: "confirmed", note: note ?? `Transfer to ${to.username ?? to.telegramId}`, refUserId: to.id }).returning();
      await tx.insert(transactionsTable).values({ userId: to.id, type: "transfer_in", amount: amount.toString(), status: "confirmed", note: note ?? `Transfer from ${from.username ?? from.telegramId}`, refUserId: from.id });

      return out;
    });

    res.json(serializeTx(txOut));
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      res.status(400).json({ error: "Insufficient SKZ balance" });
      return;
    }
    req.log.error({ err }, "Error processing transfer");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/wallet/transactions
router.get("/transactions", requireAuth, async (req, res) => {
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  const { page = 1, limit = 20 } = parsed.success ? parsed.data : {};
  // Actor is derived from the authenticated identity, never the client query.
  const telegram_id = req.auth!.telegramId;
  const offset = (page - 1) * limit;

  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegram_id)).limit(1);
    if (users.length === 0) { res.status(404).json({ error: "User not found" }); return; }

    const userId = users[0].id;
    const [txs, countResult] = await Promise.all([
      db.select().from(transactionsTable).where(eq(transactionsTable.userId, userId)).orderBy(transactionsTable.createdAt).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(transactionsTable).where(eq(transactionsTable.userId, userId)),
    ]);

    res.json({ transactions: txs.map(serializeTx), total: Number(countResult[0].count), page, limit });
  } catch (err) {
    req.log.error({ err }, "Error fetching transactions");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/wallet/stats
router.get("/stats", async (req, res) => {
  try {
    const [circulationResult, depositedResult, txCountResult, walletCountResult] = await Promise.all([
      db.select({ sum: sql<number>`coalesce(sum(skz_balance), 0)` }).from(usersTable),
      db.select({ sum: sql<number>`coalesce(sum(amount), 0)` }).from(transactionsTable).where(eq(transactionsTable.type, "deposit")),
      db.select({ count: sql<number>`count(*)` }).from(transactionsTable),
      db.select({ count: sql<number>`count(*)` }).from(usersTable).where(sql`skz_balance > 0`),
    ]);
    const settings = await db.select().from(settingsTable).limit(1);
    res.json({
      totalSkzInCirculation: Number(circulationResult[0].sum),
      totalDeposited: Number(depositedResult[0].sum),
      totalTransactions: Number(txCountResult[0].count),
      activeWallets: Number(walletCountResult[0].count),
      tonRate: settings.length > 0 ? parseFloat(settings[0].skzPerTon) : 100,
      usdtRate: settings.length > 0 ? parseFloat(settings[0].skzPerUsdt) : 10,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching wallet stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
