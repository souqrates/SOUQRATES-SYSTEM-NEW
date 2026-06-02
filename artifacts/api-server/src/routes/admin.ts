import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, transactionsTable, subagentApplicationsTable, settingsTable } from "@workspace/db";
import { eq, sql, desc, and } from "drizzle-orm";
import { BanUserBody, SendBroadcastBody, ListAllTransactionsQueryParams } from "@workspace/api-zod";
import { testSentry } from "../lib/monitoring";
import { testRedis, testQStash } from "../lib/cache";

const router = Router();

function serializeUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    telegramId: u.telegramId,
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
    photoUrl: u.photoUrl,
    skzBalance: parseFloat(u.skzBalance),
    referralCode: u.referralCode,
    referredBy: u.referredBy,
    isAdmin: u.isAdmin,
    isBanned: u.isBanned,
    totalEarned: parseFloat(u.totalEarned),
    createdAt: u.createdAt.toISOString(),
  };
}

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

// GET /api/admin/dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalUsersResult,
      activeUsersResult,
      bannedUsersResult,
      totalSkzResult,
      totalTxResult,
      newTodayResult,
      revenueTodayResult,
      revenueMonthResult,
      topReferrers,
      recentTxs,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(usersTable),
      db.select({ count: sql<number>`count(*)` }).from(usersTable).where(sql`skz_balance > 0`),
      db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.isBanned, true)),
      db.select({ sum: sql<number>`coalesce(sum(skz_balance), 0)` }).from(usersTable),
      db.select({ count: sql<number>`count(*)` }).from(transactionsTable),
      db.select({ count: sql<number>`count(*)` }).from(usersTable).where(sql`created_at >= ${today.toISOString()}`),
      db.select({ sum: sql<number>`coalesce(sum(amount), 0)` }).from(transactionsTable)
        .where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "confirmed"), sql`created_at >= ${today.toISOString()}`)),
      db.select({ sum: sql<number>`coalesce(sum(amount), 0)` }).from(transactionsTable)
        .where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "confirmed"), sql`created_at >= ${firstOfMonth.toISOString()}`)),
      db.select({
        userId: usersTable.id, username: usersTable.username, firstName: usersTable.firstName,
        totalEarned: usersTable.totalEarned,
        referralCount: sql<number>`(select count(*) from users where referred_by = users.id)`,
      }).from(usersTable).orderBy(desc(usersTable.totalEarned)).limit(5),
      db.select().from(transactionsTable).orderBy(desc(transactionsTable.createdAt)).limit(10),
    ]);

    res.json({
      totalUsers: Number(totalUsersResult[0].count),
      activeUsers: Number(activeUsersResult[0].count),
      bannedUsers: Number(bannedUsersResult[0].count),
      totalSkz: Number(totalSkzResult[0].sum),
      totalTransactions: Number(totalTxResult[0].count),
      newUsersToday: Number(newTodayResult[0].count),
      revenueToday: Number(revenueTodayResult[0].sum),
      revenueThisMonth: Number(revenueMonthResult[0].sum),
      topReferrers: topReferrers.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        username: r.username,
        firstName: r.firstName,
        referralCount: Number(r.referralCount),
        totalEarned: parseFloat(r.totalEarned),
      })),
      recentTransactions: recentTxs.map(serializeTx),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching admin dashboard");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/users/:userId/ban
router.post("/users/:userId/ban", async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  const parsed = BanUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  try {
    const updated = await db.update(usersTable)
      .set({ isBanned: parsed.data.banned, banReason: parsed.data.reason ?? null })
      .where(eq(usersTable.id, userId))
      .returning();
    if (updated.length === 0) { res.status(404).json({ error: "User not found" }); return; }
    res.json(serializeUser(updated[0]));
  } catch (err) {
    req.log.error({ err }, "Error banning user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/broadcast
router.post("/broadcast", async (req, res) => {
  const parsed = SendBroadcastBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  try {
    let targetCount = 0;
    if (parsed.data.targetGroup === "referrers") {
      const result = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(sql`total_earned > 0`);
      targetCount = Number(result[0].count);
    } else if (parsed.data.targetGroup === "active") {
      const result = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(sql`skz_balance > 0`);
      targetCount = Number(result[0].count);
    } else {
      const result = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.isBanned, false));
      targetCount = Number(result[0].count);
    }
    req.log.info({ message: parsed.data.message, targetGroup: parsed.data.targetGroup }, "Broadcast queued");
    res.json({ queued: true, targetCount, message: "Broadcast message queued successfully" });
  } catch (err) {
    req.log.error({ err }, "Error sending broadcast");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/transactions
router.get("/transactions", async (req, res) => {
  const parsed = ListAllTransactionsQueryParams.safeParse(req.query);
  const page = parsed.data?.page ?? 1;
  const limit = parsed.data?.limit ?? 20;
  const type = parsed.data?.type;
  const status = parsed.data?.status;
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    if (type) conditions.push(eq(transactionsTable.type, type));
    if (status) conditions.push(eq(transactionsTable.status, status));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [txs, countResult] = await Promise.all([
      db.select().from(transactionsTable).where(whereClause).orderBy(desc(transactionsTable.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(transactionsTable).where(whereClause),
    ]);

    res.json({ transactions: txs.map(serializeTx), total: Number(countResult[0].count), page, limit });
  } catch (err) {
    req.log.error({ err }, "Error listing all transactions");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/users/:userId/send-skz
router.post("/users/:userId/send-skz", async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  const { amount, note } = req.body;
  const amt = parseFloat(amount);
  if (!amount || isNaN(amt) || amt <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const newBalance = (parseFloat(user.skzBalance) + amt).toFixed(6);
    await db.update(usersTable).set({ skzBalance: newBalance }).where(eq(usersTable.id, userId));
    await db.insert(transactionsTable).values({
      userId, type: "transfer_in", amount: amt.toFixed(6), status: "confirmed",
      note: note || "Admin credit",
    });
    res.json({ success: true, newBalance: parseFloat(newBalance) });
  } catch (err) {
    req.log.error({ err }, "Error sending SKZ to user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/users/:userId/deduct-skz
router.post("/users/:userId/deduct-skz", async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  const { amount, note } = req.body;
  const amt = parseFloat(amount);
  if (!amount || isNaN(amt) || amt <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const currentBal = parseFloat(user.skzBalance);
    if (currentBal < amt) { res.status(400).json({ error: "Insufficient balance" }); return; }
    const newBalance = (currentBal - amt).toFixed(6);
    await db.update(usersTable).set({ skzBalance: newBalance }).where(eq(usersTable.id, userId));
    await db.insert(transactionsTable).values({
      userId, type: "transfer_out", amount: amt.toFixed(6), status: "confirmed",
      note: note || "Admin deduction",
    });
    res.json({ success: true, newBalance: parseFloat(newBalance) });
  } catch (err) {
    req.log.error({ err }, "Error deducting SKZ from user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/subagent-applications
router.get("/subagent-applications", async (req, res) => {
  try {
    const apps = await db
      .select()
      .from(subagentApplicationsTable)
      .orderBy(desc(subagentApplicationsTable.createdAt));
    res.json(apps.map((a) => ({
      id: a.id,
      userId: a.userId,
      telegramId: a.telegramId,
      fullName: a.fullName,
      phone: a.phone,
      email: a.email,
      company: a.company,
      experience: a.experience,
      motivation: a.motivation,
      status: a.status,
      reviewNote: a.reviewNote,
      reviewedAt: a.reviewedAt ? a.reviewedAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Error listing subagent applications");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Infrastructure routes ─────────────────────────────────────────────────

function maskToken(t: string | null | undefined): string {
  if (!t) return "";
  if (t.length <= 8) return "****";
  return t.slice(0, 4) + "****" + t.slice(-4);
}

// GET /api/admin/infrastructure
router.get("/infrastructure", async (req, res) => {
  try {
    const rows = await db.select().from(settingsTable).limit(1);
    const s = rows[0];
    if (!s) { res.json({}); return; }
    res.json({
      sentryDsn:           s.sentryDsn || "",
      upstashRedisUrl:     s.upstashRedisUrl || "",
      upstashRedisToken:   maskToken(s.upstashRedisToken),
      upstashQstashUrl:    s.upstashQstashUrl || "",
      upstashQstashToken:  maskToken(s.upstashQstashToken),
      contaboWebhookUrl:   s.contaboWebhookUrl || "",
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching infra settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/infrastructure — save one service's config
router.post("/infrastructure", async (req, res) => {
  const { service, url, token } = req.body as { service: string; url: string; token?: string };
  const fieldMap: Record<string, { urlField: keyof typeof settingsTable.$inferInsert; tokenField?: keyof typeof settingsTable.$inferInsert }> = {
    sentry:          { urlField: "sentryDsn" },
    upstash_redis:   { urlField: "upstashRedisUrl",  tokenField: "upstashRedisToken"  },
    upstash_qstash:  { urlField: "upstashQstashUrl", tokenField: "upstashQstashToken" },
    contabo_webhook: { urlField: "contaboWebhookUrl" },
  };
  const fields = fieldMap[service];
  if (!fields) { res.status(400).json({ error: "Unknown service" }); return; }

  try {
    const update = { [fields.urlField]: url || null } as Partial<typeof settingsTable.$inferInsert>;
    if (fields.tokenField) (update as Record<string, unknown>)[fields.tokenField] = token || null;

    const rows = await db.select().from(settingsTable).limit(1);
    if (rows.length === 0) {
      await db.insert(settingsTable).values(update as typeof settingsTable.$inferInsert);
    } else {
      await db.update(settingsTable).set(update).where(eq(settingsTable.id, rows[0].id));
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error saving infra settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/infrastructure/test — live connection test
router.post("/infrastructure/test", async (req, res) => {
  const { service, url, token } = req.body as { service: string; url: string; token?: string };
  try {
    if (service === "sentry") {
      res.json(await testSentry(url));
    } else if (service === "upstash_redis") {
      if (!token) { res.json({ ok: false, message: "Token required" }); return; }
      res.json(await testRedis(url, token));
    } else if (service === "upstash_qstash") {
      if (!token) { res.json({ ok: false, message: "Token required" }); return; }
      res.json(await testQStash(url, token));
    } else if (service === "contabo_webhook") {
      // Test server reachability via health endpoint
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const r = await fetch(`${url}/api/healthz`, { signal: controller.signal });
        clearTimeout(timeout);
        if (r.ok) {
          res.json({ ok: true, message: `Server reachable — ${url} responded with ${r.status}` });
        } else {
          res.json({ ok: false, message: `Server responded with HTTP ${r.status}` });
        }
      } catch (err) {
        res.json({ ok: false, message: `Cannot reach server: ${err instanceof Error ? err.message : String(err)}` });
      }
    } else {
      res.status(400).json({ ok: false, message: "Unknown service" });
    }
  } catch (err) {
    req.log.error({ err }, "Infrastructure test error");
    res.status(500).json({ ok: false, message: "Internal server error" });
  }
});

// PATCH /api/admin/subagent-applications/:id
router.patch("/subagent-applications/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { status, reviewNote } = req.body;
  if (!status || !["approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status must be approved or rejected" });
    return;
  }
  try {
    const updated = await db
      .update(subagentApplicationsTable)
      .set({ status, reviewNote: reviewNote || null, reviewedAt: new Date() })
      .where(eq(subagentApplicationsTable.id, id))
      .returning();
    if (updated.length === 0) { res.status(404).json({ error: "Application not found" }); return; }
    const a = updated[0];
    res.json({
      id: a.id, userId: a.userId, telegramId: a.telegramId, fullName: a.fullName,
      phone: a.phone, email: a.email, company: a.company, experience: a.experience,
      motivation: a.motivation, status: a.status, reviewNote: a.reviewNote,
      reviewedAt: a.reviewedAt ? a.reviewedAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error reviewing subagent application");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
