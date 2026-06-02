import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, transactionsTable, settingsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { GetMyReferralsQueryParams, GetReferralEarningsQueryParams, GetReferralLeaderboardQueryParams } from "@workspace/api-zod";

const router = Router();

// GET /api/referrals/my
router.get("/my", async (req, res) => {
  const parsed = GetMyReferralsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "telegram_id is required" });
    return;
  }
  const { telegram_id } = parsed.data;

  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegram_id)).limit(1);
    if (users.length === 0) { res.status(404).json({ error: "User not found" }); return; }
    const user = users[0];

    const settings = await db.select().from(settingsTable).limit(1);
    const l1Rate = settings.length > 0 ? parseFloat(settings[0].level1Rate) : 10;
    const l2Rate = settings.length > 0 ? parseFloat(settings[0].level2Rate) : 5;
    const l3Rate = settings.length > 0 ? parseFloat(settings[0].level3Rate) : 2;

    // Level 1 referrals
    const level1 = await db.select().from(usersTable).where(eq(usersTable.referredBy, user.id));

    // Level 2 referrals
    const level1Ids = level1.map(u => u.id);
    let level2: (typeof usersTable.$inferSelect)[] = [];
    if (level1Ids.length > 0) {
      for (const id of level1Ids) {
        const refs = await db.select().from(usersTable).where(eq(usersTable.referredBy, id));
        level2 = [...level2, ...refs];
      }
    }

    // Level 3 referrals
    const level2Ids = level2.map(u => u.id);
    let level3: (typeof usersTable.$inferSelect)[] = [];
    if (level2Ids.length > 0) {
      for (const id of level2Ids) {
        const refs = await db.select().from(usersTable).where(eq(usersTable.referredBy, id));
        level3 = [...level3, ...refs];
      }
    }

    const referralLink = `https://t.me/souqrates_bot?start=${user.referralCode}`;

    const allReferrees = [
      ...level1.map(u => ({ id: u.id, username: u.username, firstName: u.firstName, level: 1, joinedAt: u.createdAt.toISOString(), earned: parseFloat(u.totalEarned) })),
      ...level2.map(u => ({ id: u.id, username: u.username, firstName: u.firstName, level: 2, joinedAt: u.createdAt.toISOString(), earned: parseFloat(u.totalEarned) })),
      ...level3.map(u => ({ id: u.id, username: u.username, firstName: u.firstName, level: 3, joinedAt: u.createdAt.toISOString(), earned: parseFloat(u.totalEarned) })),
    ];

    res.json({
      telegramId: telegram_id,
      referralCode: user.referralCode,
      referralLink,
      level1Count: level1.length,
      level2Count: level2.length,
      level3Count: level3.length,
      level1Rate: l1Rate,
      level2Rate: l2Rate,
      level3Rate: l3Rate,
      referrees: allReferrees,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching referrals");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/referrals/earnings
router.get("/earnings", async (req, res) => {
  const parsed = GetReferralEarningsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "telegram_id is required" });
    return;
  }
  const { telegram_id } = parsed.data;

  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegram_id)).limit(1);
    if (users.length === 0) { res.status(404).json({ error: "User not found" }); return; }
    const user = users[0];

    // Get all commission transactions
    const commissions = await db.select().from(transactionsTable)
      .where(eq(transactionsTable.userId, user.id))
      .where(eq(transactionsTable.type, "commission"))
      .where(eq(transactionsTable.status, "confirmed"));

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const totalEarned = commissions.reduce((s, t) => s + parseFloat(t.amount), 0);
    const thisMonth = commissions.filter(t => t.createdAt >= firstOfMonth).reduce((s, t) => s + parseFloat(t.amount), 0);

    // Approximate levels by note content
    const l1 = commissions.filter(t => t.note?.startsWith("L1")).reduce((s, t) => s + parseFloat(t.amount), 0);
    const l2 = commissions.filter(t => t.note?.startsWith("L2")).reduce((s, t) => s + parseFloat(t.amount), 0);
    const l3 = commissions.filter(t => t.note?.startsWith("L3")).reduce((s, t) => s + parseFloat(t.amount), 0);

    res.json({ totalEarned, level1Earned: l1, level2Earned: l2, level3Earned: l3, thisMonth });
  } catch (err) {
    req.log.error({ err }, "Error fetching referral earnings");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/referrals/leaderboard
router.get("/leaderboard", async (req, res) => {
  const parsed = GetReferralLeaderboardQueryParams.safeParse(req.query);
  const limit = parsed.data?.limit ?? 10;

  try {
    const topReferrers = await db
      .select({
        userId: usersTable.id,
        username: usersTable.username,
        firstName: usersTable.firstName,
        totalEarned: usersTable.totalEarned,
        referralCount: sql<number>`(select count(*) from users where referred_by = users.id)`,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.totalEarned))
      .limit(limit);

    res.json(
      topReferrers.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        username: r.username,
        firstName: r.firstName,
        referralCount: Number(r.referralCount),
        totalEarned: parseFloat(r.totalEarned),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Error fetching leaderboard");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
