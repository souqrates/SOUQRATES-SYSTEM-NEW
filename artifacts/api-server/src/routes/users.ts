import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, ilike, sql, or } from "drizzle-orm";
import { RegisterUserBody, ListUsersQueryParams, GetMeQueryParams } from "@workspace/api-zod";
import { randomBytes } from "crypto";

const router = Router();

function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

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

// POST /api/users/register
router.post("/register", async (req, res) => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const { telegramId, username, firstName, lastName, photoUrl, referralCode } = parsed.data;

  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);

    if (existing.length > 0) {
      const user = existing[0];
      // Update profile info on re-login
      const updated = await db
        .update(usersTable)
        .set({ username: username ?? user.username, firstName: firstName ?? user.firstName, photoUrl: photoUrl ?? user.photoUrl })
        .where(eq(usersTable.telegramId, telegramId))
        .returning();
      res.json(serializeUser(updated[0]));
      return;
    }

    // Resolve referral
    let referredById: number | undefined;
    if (referralCode) {
      const referrer = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode)).limit(1);
      if (referrer.length > 0) referredById = referrer[0].id;
    }

    const newCode = generateReferralCode();
    const inserted = await db
      .insert(usersTable)
      .values({
        telegramId,
        username,
        firstName,
        lastName,
        photoUrl,
        referralCode: newCode,
        referredBy: referredById ?? null,
      })
      .returning();

    res.json(serializeUser(inserted[0]));
  } catch (err) {
    req.log.error({ err }, "Error registering user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/me
router.get("/me", async (req, res) => {
  const parsed = GetMeQueryParams.safeParse(req.query);
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
    res.json(serializeUser(users[0]));
  } catch (err) {
    req.log.error({ err }, "Error fetching user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:userId
router.get("/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (users.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(serializeUser(users[0]));
  } catch (err) {
    req.log.error({ err }, "Error fetching user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users
router.get("/", async (req, res) => {
  const parsed = ListUsersQueryParams.safeParse(req.query);
  const page = parsed.data?.page ?? 1;
  const limit = parsed.data?.limit ?? 20;
  const search = parsed.data?.search;
  const offset = (page - 1) * limit;

  try {
    const whereClause = search
      ? or(ilike(usersTable.username, `%${search}%`), ilike(usersTable.firstName, `%${search}%`), eq(usersTable.telegramId, search))
      : undefined;

    const [users, countResult] = await Promise.all([
      db.select().from(usersTable).where(whereClause).limit(limit).offset(offset).orderBy(usersTable.createdAt),
      db.select({ count: sql<number>`count(*)` }).from(usersTable).where(whereClause),
    ]);

    res.json({
      users: users.map(serializeUser),
      total: Number(countResult[0].count),
      page,
      limit,
    });
  } catch (err) {
    req.log.error({ err }, "Error listing users");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
