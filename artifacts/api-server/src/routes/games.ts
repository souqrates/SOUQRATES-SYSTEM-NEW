import { Router } from "express";
import { db } from "@workspace/db";
import { skillzGamesTable, gameTicketsTable, gameSessionsTable, usersTable } from "@workspace/db";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../lib/auth";
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
  GameSessionEventParams,
  GameSessionEventBody,
} from "@workspace/api-zod";

const router = Router();

/** Thrown when a game session is ended more than once (concurrency guard). */
class SessionSettledError extends Error {}

// Server-authoritative scoring guards.
/** Grace window (s) added to the time limit to absorb client/network latency. */
const EVENT_GRACE_SECONDS = 5;
/** Minimum gap (ms) between accepted scoring events — blocks scripted spam. */
const MIN_EVENT_INTERVAL_MS = 20;
/** Max bonus a single correct hit may add over the ticket's base hit value. */
const MAX_CORRECT_BONUS = 12;

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
router.get("/session/history", requireAuth, async (req, res) => {
  try {
    const parsed = GetSessionHistoryQueryParams.safeParse(req.query);
    const { page = 1, limit = 20 } = parsed.success ? parsed.data : {};
    // Actor is derived from the authenticated identity, never the client query.
    const telegram_id = req.auth!.telegramId;

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
router.post("/session/start", requireAuth, async (req, res) => {
  try {
    const parsed = StartGameSessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const { gameId, ticketId } = parsed.data;
    // Player is always the authenticated user, never taken from the client body.
    const telegramId = req.auth!.telegramId;

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

    let insufficient = false;
    const [session] = await db.transaction(async (tx) => {
      // Atomic debit: only succeeds if the player still has the funds.
      const debited = await tx
        .update(usersTable)
        .set({ skzBalance: sql`${usersTable.skzBalance} - ${entryPrice}` })
        .where(and(eq(usersTable.id, user[0].id), sql`${usersTable.skzBalance} >= ${entryPrice}`))
        .returning({ id: usersTable.id });
      if (debited.length === 0) {
        insufficient = true;
        return [];
      }

      await tx
        .update(skillzGamesTable)
        .set({ totalPlays: sql`${skillzGamesTable.totalPlays} + 1` })
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

    if (insufficient || !session) {
      res.status(400).json({ error: "Insufficient SKZ balance" });
      return;
    }

    res.json(serializeSession(session));
  } catch (err) {
    req.log.error({ err }, "startGameSession failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/games/session/:sessionId/end
router.post("/session/:sessionId/end", requireAuth, async (req, res) => {
  try {
    const params = EndGameSessionParams.safeParse(req.params);
    const body = EndGameSessionBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const { sessionId } = params.data;
    // body.finalScore is intentionally ignored — the score is the one the
    // server tallied from validated hit events, never what the client reports.

    const session = await db
      .select()
      .from(gameSessionsTable)
      .where(eq(gameSessionsTable.id, sessionId))
      .limit(1);

    if (!session[0]) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // Ownership check: the session must belong to the authenticated user.
    const [authUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.telegramId, req.auth!.telegramId))
      .limit(1);
    if (!authUser || authUser.id !== session[0].userId) {
      res.status(403).json({ error: "Not your session" });
      return;
    }

    if (session[0].status !== "active") {
      res.status(400).json({ error: "Session already ended" });
      return;
    }

    const prizeAmount = parseFloat(session[0].prize);

    const outcome = await db.transaction(async (tx) => {
      // Read the authoritative, server-tallied score inside the transaction and
      // settle atomically. The status guard prevents a session from being ended
      // (and paid out) twice under concurrent requests.
      const [live] = await tx
        .select({
          score: gameSessionsTable.score,
          status: gameSessionsTable.status,
          targetScore: gameSessionsTable.targetScore,
          userId: gameSessionsTable.userId,
        })
        .from(gameSessionsTable)
        .where(eq(gameSessionsTable.id, sessionId))
        .limit(1);
      if (!live || live.status !== "active") throw new SessionSettledError();

      const serverScore = live.score;
      const didWin = serverScore >= live.targetScore;

      const settled = await tx
        .update(gameSessionsTable)
        .set({ status: didWin ? "won" : "lost", endedAt: new Date() })
        .where(and(eq(gameSessionsTable.id, sessionId), eq(gameSessionsTable.status, "active")))
        .returning({ id: gameSessionsTable.id });
      if (settled.length === 0) throw new SessionSettledError();

      let balance: number;
      if (didWin) {
        const [credited] = await tx
          .update(usersTable)
          .set({
            skzBalance: sql`${usersTable.skzBalance} + ${prizeAmount}`,
            totalEarned: sql`${usersTable.totalEarned} + ${prizeAmount}`,
          })
          .where(eq(usersTable.id, live.userId))
          .returning({ balance: usersTable.skzBalance });
        balance = parseFloat(credited.balance);
      } else {
        const [current] = await tx
          .select({ balance: usersTable.skzBalance })
          .from(usersTable)
          .where(eq(usersTable.id, live.userId))
          .limit(1);
        balance = parseFloat(current.balance);
      }
      return { won: didWin, serverScore, newBalance: balance };
    });

    res.json({
      sessionId,
      won: outcome.won,
      finalScore: outcome.serverScore,
      targetScore: session[0].targetScore,
      prizeAwarded: outcome.won ? prizeAmount : 0,
      newBalance: outcome.newBalance,
      message: outcome.won
        ? `You won ${prizeAmount.toFixed(2)} SKZ!`
        : `Better luck next time! Target was ${session[0].targetScore} points.`,
    });
  } catch (err) {
    if (err instanceof SessionSettledError) {
      res.status(400).json({ error: "Session already ended" });
      return;
    }
    req.log.error({ err }, "endGameSession failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/games/session/:sessionId/event — record one validated hit event.
// This is the ONLY way a session's score grows; the score is tallied entirely
// server-side from these events so the client can never claim an arbitrary
// final score. Each event is rate-limited and must fall within the time window.
router.post("/session/:sessionId/event", requireAuth, async (req, res) => {
  const params = GameSessionEventParams.safeParse(req.params);
  const body = GameSessionEventBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { sessionId } = params.data;
  const { correct, points } = body.data;

  try {
    const [authUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.telegramId, req.auth!.telegramId))
      .limit(1);
    if (!authUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      // Row lock: serialize concurrent events for the same session so the
      // throttle window and combo/score math are always evaluated against
      // committed state. Without this, racing requests read stale
      // score/combo/lastEventAt and lost updates inflate or corrupt the tally.
      const [s] = await tx
        .select()
        .from(gameSessionsTable)
        .where(eq(gameSessionsTable.id, sessionId))
        .limit(1)
        .for("update");
      if (!s) return { kind: "not_found" as const };
      if (s.userId !== authUser.id) return { kind: "forbidden" as const };
      if (s.status !== "active") return { kind: "inactive" as const };

      const now = Date.now();
      const startedAt = s.startedAt.getTime();
      // Time window: reject events past the time limit (+ small grace for latency).
      if (now > startedAt + (s.timeLimitSeconds + EVENT_GRACE_SECONDS) * 1000) {
        return { kind: "expired" as const, score: s.score };
      }
      // Rate cap: reject implausibly fast bursts. Generous enough for human
      // play; blocks scripted spam. Throttled events are no-ops, not errors.
      if (s.lastEventAt && now - s.lastEventAt.getTime() < MIN_EVENT_INTERVAL_MS) {
        return { kind: "throttled" as const, score: s.score, combo: s.combo };
      }

      // Server-side scoring math (mirrors the client's combo feel). Per-hit
      // value is clamped so a tampered `points` can't inflate a single event.
      let combo = s.combo;
      let delta: number;
      if (correct) {
        combo += 1;
        const base = Math.max(1, Math.min(points ?? s.correctHitValue, s.correctHitValue + MAX_CORRECT_BONUS));
        const multiplier = Math.min(4, 1 + Math.floor(combo / 4) * 0.5);
        delta = Math.round(base * multiplier);
      } else {
        combo = 0;
        delta = -s.wrongHitPenalty;
      }
      const newScore = Math.max(0, s.score + delta);

      const [updated] = await tx
        .update(gameSessionsTable)
        .set({ score: newScore, combo, lastEventAt: new Date(now) })
        .where(and(eq(gameSessionsTable.id, sessionId), eq(gameSessionsTable.status, "active")))
        .returning({ score: gameSessionsTable.score, combo: gameSessionsTable.combo });
      if (!updated) return { kind: "inactive" as const };

      return {
        kind: "ok" as const,
        score: updated.score,
        combo: updated.combo,
        reachedTarget: updated.score >= s.targetScore,
      };
    });

    switch (result.kind) {
      case "not_found":
        res.status(404).json({ error: "Session not found" });
        return;
      case "forbidden":
        res.status(403).json({ error: "Not your session" });
        return;
      case "inactive":
        res.status(409).json({ error: "Session is not active" });
        return;
      case "expired":
        res.status(409).json({ error: "Session time limit exceeded", score: result.score });
        return;
      case "throttled":
        res.json({ score: result.score, combo: result.combo, reachedTarget: false, throttled: true });
        return;
      default:
        res.json({ score: result.score, combo: result.combo, reachedTarget: result.reachedTarget, throttled: false });
        return;
    }
  } catch (err) {
    req.log.error({ err }, "gameSessionEvent failed");
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
router.patch("/:gameId", requireAdmin, async (req, res) => {
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
router.patch("/:gameId/tickets", requireAdmin, async (req, res) => {
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
