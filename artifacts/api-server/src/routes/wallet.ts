import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, transactionsTable, settingsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { DepositWalletBody, TransferSkzBody, GetWalletBalanceQueryParams, ListTransactionsQueryParams } from "@workspace/api-zod";

const router = Router();

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
router.get("/balance", async (req, res) => {
  const parsed = GetWalletBalanceQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "telegram_id is required" });
    return;
  }
  const { telegram_id } = parsed.data;
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
router.post("/deposit", async (req, res) => {
  const parsed = DepositWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const { telegramId, amount, currency, txHash, network } = parsed.data;

  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);
    if (users.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = users[0];

    // Get conversion rate
    const settings = await db.select().from(settingsTable).limit(1);
    const rate = settings.length > 0
      ? (currency === "TON" ? parseFloat(settings[0].skzPerTon) : parseFloat(settings[0].skzPerUsdt))
      : 100;
    const skzAmount = amount * rate;

    const tx = await db.insert(transactionsTable).values({
      userId: user.id,
      type: "deposit",
      amount: skzAmount.toString(),
      currency,
      txHash,
      status: "confirmed",
      note: `Deposit ${amount} ${currency} via ${network ?? "blockchain"}`,
    }).returning();

    // Credit balance
    await db.update(usersTable)
      .set({ skzBalance: sql`${usersTable.skzBalance} + ${skzAmount}` })
      .where(eq(usersTable.id, user.id));

    // Process referral commissions
    await processReferralCommissions(user.id, skzAmount, settings.length > 0 ? settings[0] : null);

    res.json(serializeTx(tx[0]));
  } catch (err) {
    req.log.error({ err }, "Error processing deposit");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function processReferralCommissions(userId: number, skzAmount: number, settings: any) {
  const level1Rate = settings ? parseFloat(settings.level1Rate) / 100 : 0.10;
  const level2Rate = settings ? parseFloat(settings.level2Rate) / 100 : 0.05;
  const level3Rate = settings ? parseFloat(settings.level3Rate) / 100 : 0.02;

  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (user.length === 0 || !user[0].referredBy) return;

  // Level 1
  const ref1 = await db.select().from(usersTable).where(eq(usersTable.id, user[0].referredBy)).limit(1);
  if (ref1.length > 0) {
    const commission1 = skzAmount * level1Rate;
    await db.update(usersTable).set({
      skzBalance: sql`${usersTable.skzBalance} + ${commission1}`,
      totalEarned: sql`${usersTable.totalEarned} + ${commission1}`,
    }).where(eq(usersTable.id, ref1[0].id));
    await db.insert(transactionsTable).values({
      userId: ref1[0].id,
      type: "commission",
      amount: commission1.toString(),
      status: "confirmed",
      note: `L1 commission from user ${userId}`,
      refUserId: userId,
    });

    // Level 2
    if (ref1[0].referredBy) {
      const ref2 = await db.select().from(usersTable).where(eq(usersTable.id, ref1[0].referredBy)).limit(1);
      if (ref2.length > 0) {
        const commission2 = skzAmount * level2Rate;
        await db.update(usersTable).set({
          skzBalance: sql`${usersTable.skzBalance} + ${commission2}`,
          totalEarned: sql`${usersTable.totalEarned} + ${commission2}`,
        }).where(eq(usersTable.id, ref2[0].id));
        await db.insert(transactionsTable).values({
          userId: ref2[0].id,
          type: "commission",
          amount: commission2.toString(),
          status: "confirmed",
          note: `L2 commission from user ${userId}`,
          refUserId: userId,
        });

        // Level 3
        if (ref2[0].referredBy) {
          const ref3 = await db.select().from(usersTable).where(eq(usersTable.id, ref2[0].referredBy)).limit(1);
          if (ref3.length > 0) {
            const commission3 = skzAmount * level3Rate;
            await db.update(usersTable).set({
              skzBalance: sql`${usersTable.skzBalance} + ${commission3}`,
              totalEarned: sql`${usersTable.totalEarned} + ${commission3}`,
            }).where(eq(usersTable.id, ref3[0].id));
            await db.insert(transactionsTable).values({
              userId: ref3[0].id,
              type: "commission",
              amount: commission3.toString(),
              status: "confirmed",
              note: `L3 commission from user ${userId}`,
              refUserId: userId,
            });
          }
        }
      }
    }
  }
}

// POST /api/wallet/transfer
router.post("/transfer", async (req, res) => {
  const parsed = TransferSkzBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const { fromTelegramId, toTelegramId, amount, note } = parsed.data;

  try {
    const [fromUsers, toUsers] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.telegramId, fromTelegramId)).limit(1),
      db.select().from(usersTable).where(eq(usersTable.telegramId, toTelegramId)).limit(1),
    ]);
    if (fromUsers.length === 0) { res.status(404).json({ error: "Sender not found" }); return; }
    if (toUsers.length === 0) { res.status(404).json({ error: "Recipient not found" }); return; }

    const from = fromUsers[0];
    const to = toUsers[0];

    if (parseFloat(from.skzBalance) < amount) {
      res.status(400).json({ error: "Insufficient SKZ balance" });
      return;
    }

    // Debit sender
    await db.update(usersTable).set({ skzBalance: sql`${usersTable.skzBalance} - ${amount}` }).where(eq(usersTable.id, from.id));
    // Credit receiver
    await db.update(usersTable).set({ skzBalance: sql`${usersTable.skzBalance} + ${amount}` }).where(eq(usersTable.id, to.id));

    const [txOut] = await Promise.all([
      db.insert(transactionsTable).values({ userId: from.id, type: "transfer_out", amount: amount.toString(), status: "confirmed", note: note ?? `Transfer to ${to.username ?? to.telegramId}`, refUserId: to.id }).returning(),
      db.insert(transactionsTable).values({ userId: to.id, type: "transfer_in", amount: amount.toString(), status: "confirmed", note: note ?? `Transfer from ${from.username ?? from.telegramId}`, refUserId: from.id }),
    ]);

    res.json(serializeTx(txOut[0]));
  } catch (err) {
    req.log.error({ err }, "Error processing transfer");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/wallet/transactions
router.get("/transactions", async (req, res) => {
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "telegram_id is required" });
    return;
  }
  const { telegram_id, page = 1, limit = 20 } = parsed.data;
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
