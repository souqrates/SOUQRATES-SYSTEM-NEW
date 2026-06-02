import { Router } from "express";
import { db } from "@workspace/db";
import { skillzGamesTable, gameTicketsTable, gameSessionsTable, usersTable } from "@workspace/db";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import {
  ListGamesQueryParams,
  GetGameParams,
  UpdateGameParams,
  UpdateGameBody,
  StartGameSessionBody,
  EndGameSessionParams,
  EndGameSessionBody,
  GetSessionHistoryQueryParams,
  FetchLeaderboardQueryParams,
  UpdateGameTicketParams,
  UpdateGameTicketBody,
} from "@workspace/api-zod";

const router = Router();

function serializeGame(g: typeof skillzGamesTable.$inferSelect) {
  return {
    id: g.id,
    name: g.name,
    slug: g.slug,
    category: g.category,
    description: g.description,
    isActive: g.isActive,
    totalPlays: g.totalPlays,
    difficultyLabel: g.difficultyLabel,
    tags: g.tags,
    createdAt: g.createdAt.toISOString(),
  };
}

function serializeTicket(t: typeof gameTicketsTable.$inferSelect) {
  return {
    id: t.id,
    gameId: t.gameId,
    tier: t.tier,
    name: t.name,
    entryPrice: parseFloat(t.entryPrice),
    prize: parseFloat(t.prize),
    targetScore: t.targetScore,
    timeLimitSeconds: t.timeLimitSeconds,
    correctHitValue: t.correctHitValue,
    wrongHitPenalty: t.wrongHitPenalty,
    isActive: t.isActive,
  };
}

function serializeSession(s: typeof gameSessionsTable.$inferSelect) {
  return {
    id: s.id,
    userId: s.userId,
    gameId: s.gameId,
    ticketId: s.ticketId,
    status: s.status,
    score: s.score,
    entryPrice: parseFloat(s.entryPrice),
    prize: parseFloat(s.prize),
    targetScore: s.targetScore,
    timeLimitSeconds: s.timeLimitSeconds,
    correctHitValue: s.correctHitValue,
    wrongHitPenalty: s.wrongHitPenalty,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt ? s.endedAt.toISOString() : null,
  };
}

// GET /api/games
router.get("/", async (req, res) => {
  try {
    const parsed = ListGamesQueryParams.safeParse(req.query);
    const filters = parsed.success ? parsed.data : {};

    let query = db.select().from(skillzGamesTable).$dynamic();

    if (filters.isActive !== undefined) {
      query = query.where(eq(skillzGamesTable.isActive, filters.isActive));
    }
    if (filters.category) {
      query = query.where(eq(skillzGamesTable.category, filters.category));
    }

    const games = await query.orderBy(skillzGamesTable.id);
    res.json(games.map(serializeGame));
  } catch (err) {
    req.log.error({ err }, "listGames failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/games/stats
router.get("/stats", async (req, res) => {
  try {
    const [
      gamesResult,
      sessionsResult,
      winsResult,
      prizesResult,
      revenueResult,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(skillzGamesTable),
      db.select({ count: sql<number>`count(*)` }).from(gameSessionsTable),
      db
        .select({ count: sql<number>`count(*)` })
        .from(gameSessionsTable)
        .where(eq(gameSessionsTable.status, "won")),
      db
        .select({ total: sql<string>`coalesce(sum(prize),0)` })
        .from(gameSessionsTable)
        .where(eq(gameSessionsTable.status, "won")),
      db
        .select({ total: sql<string>`coalesce(sum(entry_price),0)` })
        .from(gameSessionsTable),
    ]);

    const activeGames = await db
      .select({ count: sql<number>`count(*)` })
      .from(skillzGamesTable)
      .where(eq(skillzGamesTable.isActive, true));

    const topGameResult = await db
      .select({ name: skillzGamesTable.name })
      .from(skillzGamesTable)
      .orderBy(desc(skillzGamesTable.totalPlays))
      .limit(1);

    res.json({
      totalGames: Number(gamesResult[0].count),
      totalSessions: Number(sessionsResult[0].count),
      totalWins: Number(winsResult[0].count),
      totalPrizesAwarded: parseFloat(prizesResult[0].total),
      totalRevenue: parseFloat(revenueResult[0].total),
      activeGames: Number(activeGames[0].count),
      topGame: topGameResult[0]?.name ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "getGamesStats failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/games/leaderboard
router.get("/leaderboard", async (req, res) => {
  try {
    const parsed = FetchLeaderboardQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "game_id is required" });
      return;
    }
    const { game_id, limit = 20 } = parsed.data;

    const rows = await db
      .select({
        userId: gameSessionsTable.userId,
        bestScore: sql<number>`max(${gameSessionsTable.score})`,
        totalWins: sql<number>`count(*) filter (where ${gameSessionsTable.status} = 'won')`,
        totalPrizeEarned: sql<string>`coalesce(sum(${gameSessionsTable.prize}) filter (where ${gameSessionsTable.status} = 'won'), 0)`,
        username: usersTable.username,
        firstName: usersTable.firstName,
      })
      .from(gameSessionsTable)
      .innerJoin(usersTable, eq(gameSessionsTable.userId, usersTable.id))
      .where(eq(gameSessionsTable.gameId, game_id))
      .groupBy(gameSessionsTable.userId, usersTable.username, usersTable.firstName)
      .orderBy(desc(sql`max(${gameSessionsTable.score})`))
      .limit(limit);

    res.json(
      rows.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        username: r.username,
        firstName: r.firstName,
        bestScore: Number(r.bestScore),
        totalWins: Number(r.totalWins),
        totalPrizeEarned: parseFloat(r.totalPrizeEarned),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "fetchLeaderboard failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/games/session/history
router.get("/session/history", async (req, res) => {
  try {
    const parsed = GetSessionHistoryQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "telegram_id is required" });
      return;
    }
    const { telegram_id, page = 1, limit = 20 } = parsed.data;

    const user = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, telegram_id))
      .limit(1);

    if (!user[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const offset = (page - 1) * limit;
    const [sessions, totalResult] = await Promise.all([
      db
        .select()
        .from(gameSessionsTable)
        .where(eq(gameSessionsTable.userId, user[0].id))
        .orderBy(desc(gameSessionsTable.startedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(gameSessionsTable)
        .where(eq(gameSessionsTable.userId, user[0].id)),
    ]);

    res.json({
      sessions: sessions.map(serializeSession),
      total: Number(totalResult[0].count),
      page,
      limit,
    });
  } catch (err) {
    req.log.error({ err }, "getSessionHistory failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/games/session/start
router.post("/session/start", async (req, res) => {
  try {
    const parsed = StartGameSessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const { telegramId, gameId, ticketId } = parsed.data;

    const [user, game, ticket] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1),
      db.select().from(skillzGamesTable).where(eq(skillzGamesTable.id, gameId)).limit(1),
      db.select().from(gameTicketsTable).where(eq(gameTicketsTable.id, ticketId)).limit(1),
    ]);

    if (!user[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (!game[0] || !game[0].isActive) {
      res.status(404).json({ error: "Game not found or inactive" });
      return;
    }
    if (!ticket[0] || !ticket[0].isActive || ticket[0].gameId !== gameId) {
      res.status(404).json({ error: "Ticket not found or inactive" });
      return;
    }

    const entryPrice = parseFloat(ticket[0].entryPrice);
    const userBalance = parseFloat(user[0].skzBalance);
    if (userBalance < entryPrice) {
      res.status(400).json({ error: "Insufficient SKZ balance" });
      return;
    }

    const [session] = await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({ skzBalance: (userBalance - entryPrice).toFixed(6) })
        .where(eq(usersTable.id, user[0].id));

      await tx
        .update(skillzGamesTable)
        .set({ totalPlays: game[0].totalPlays + 1 })
        .where(eq(skillzGamesTable.id, gameId));

      return await tx
        .insert(gameSessionsTable)
        .values({
          userId: user[0].id,
          gameId,
          ticketId,
          status: "active",
          score: 0,
          entryPrice: ticket[0].entryPrice,
          prize: ticket[0].prize,
          targetScore: ticket[0].targetScore,
          timeLimitSeconds: ticket[0].timeLimitSeconds,
          correctHitValue: ticket[0].correctHitValue,
          wrongHitPenalty: ticket[0].wrongHitPenalty,
        })
        .returning();
    });

    res.json(serializeSession(session));
  } catch (err) {
    req.log.error({ err }, "startGameSession failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/games/session/:sessionId/end
router.post("/session/:sessionId/end", async (req, res) => {
  try {
    const params = EndGameSessionParams.safeParse(req.params);
    const body = EndGameSessionBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const { sessionId } = params.data;
    const { finalScore, won } = body.data;

    const session = await db
      .select()
      .from(gameSessionsTable)
      .where(eq(gameSessionsTable.id, sessionId))
      .limit(1);

    if (!session[0]) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    if (session[0].status !== "active") {
      res.status(400).json({ error: "Session already ended" });
      return;
    }

    const prizeAmount = parseFloat(session[0].prize);
    const status = won ? "won" : "lost";

    const user = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, session[0].userId))
      .limit(1);

    let newBalance = parseFloat(user[0].skzBalance);
    if (won) {
      newBalance += prizeAmount;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(gameSessionsTable)
        .set({ status, score: finalScore, endedAt: new Date() })
        .where(eq(gameSessionsTable.id, sessionId));

      if (won) {
        await tx
          .update(usersTable)
          .set({
            skzBalance: newBalance.toFixed(6),
            totalEarned: sql`${usersTable.totalEarned} + ${prizeAmount}`,
          })
          .where(eq(usersTable.id, session[0].userId));
      }
    });

    res.json({
      sessionId,
      won,
      finalScore,
      targetScore: session[0].targetScore,
      prizeAwarded: won ? prizeAmount : 0,
      newBalance,
      message: won
        ? `You won ${prizeAmount.toFixed(2)} SKZ!`
        : `Better luck next time! Target was ${session[0].targetScore} points.`,
    });
  } catch (err) {
    req.log.error({ err }, "endGameSession failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/games/:gameId
router.get("/:gameId", async (req, res) => {
  try {
    const parsed = GetGameParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid game ID" });
      return;
    }
    const { gameId } = parsed.data;

    const [game, tickets] = await Promise.all([
      db.select().from(skillzGamesTable).where(eq(skillzGamesTable.id, gameId)).limit(1),
      db
        .select()
        .from(gameTicketsTable)
        .where(eq(gameTicketsTable.gameId, gameId))
        .orderBy(gameTicketsTable.tier),
    ]);

    if (!game[0]) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    res.json({ ...serializeGame(game[0]), tickets: tickets.map(serializeTicket) });
  } catch (err) {
    req.log.error({ err }, "getGame failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/games/:gameId
router.patch("/:gameId", async (req, res) => {
  try {
    const params = UpdateGameParams.safeParse(req.params);
    const body = UpdateGameBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: "Invalid game ID" });
      return;
    }
    const { gameId } = params.data;
    const updates = body.success ? body.data : {};

    const [updated] = await db
      .update(skillzGamesTable)
      .set(updates)
      .where(eq(skillzGamesTable.id, gameId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    res.json(serializeGame(updated));
  } catch (err) {
    req.log.error({ err }, "updateGame failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/games/:gameId/tickets
router.patch("/:gameId/tickets", async (req, res) => {
  try {
    const params = UpdateGameTicketParams.safeParse(req.params);
    const body = UpdateGameTicketBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const { gameId } = params.data;
    const { tier, ...updates } = body.data;

    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.entryPrice !== undefined) updateData.entryPrice = updates.entryPrice.toFixed(6);
    if (updates.prize !== undefined) updateData.prize = updates.prize.toFixed(6);
    if (updates.targetScore !== undefined) updateData.targetScore = updates.targetScore;
    if (updates.timeLimitSeconds !== undefined) updateData.timeLimitSeconds = updates.timeLimitSeconds;
    if (updates.correctHitValue !== undefined) updateData.correctHitValue = updates.correctHitValue;
    if (updates.wrongHitPenalty !== undefined) updateData.wrongHitPenalty = updates.wrongHitPenalty;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

    await db
      .update(gameTicketsTable)
      .set(updateData)
      .where(and(eq(gameTicketsTable.gameId, gameId), eq(gameTicketsTable.tier, tier)));

    const tickets = await db
      .select()
      .from(gameTicketsTable)
      .where(eq(gameTicketsTable.gameId, gameId))
      .orderBy(gameTicketsTable.tier);

    res.json(tickets.map(serializeTicket));
  } catch (err) {
    req.log.error({ err }, "updateGameTicket failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
