import { Router } from "express";
import { db } from "@workspace/db";
import { botsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateBotBody } from "@workspace/api-zod";

const router = Router();

function serializeBot(b: typeof botsTable.$inferSelect) {
  return {
    id: b.id,
    name: b.name,
    slug: b.slug,
    description: b.description,
    isActive: b.isActive,
    userCount: b.userCount,
    iconEmoji: b.iconEmoji,
    createdAt: b.createdAt.toISOString(),
  };
}

// GET /api/bots
router.get("/", async (req, res) => {
  try {
    const bots = await db.select().from(botsTable).orderBy(botsTable.id);
    res.json(bots.map(serializeBot));
  } catch (err) {
    req.log.error({ err }, "Error listing bots");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/bots/:botId
router.get("/:botId", async (req, res) => {
  const botId = parseInt(req.params.botId);
  if (isNaN(botId)) { res.status(400).json({ error: "Invalid bot ID" }); return; }
  try {
    const bots = await db.select().from(botsTable).where(eq(botsTable.id, botId)).limit(1);
    if (bots.length === 0) { res.status(404).json({ error: "Bot not found" }); return; }
    res.json(serializeBot(bots[0]));
  } catch (err) {
    req.log.error({ err }, "Error fetching bot");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/bots/:botId
router.patch("/:botId", async (req, res) => {
  const botId = parseInt(req.params.botId);
  if (isNaN(botId)) { res.status(400).json({ error: "Invalid bot ID" }); return; }
  const parsed = UpdateBotBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  try {
    const updated = await db.update(botsTable).set(parsed.data).where(eq(botsTable.id, botId)).returning();
    if (updated.length === 0) { res.status(404).json({ error: "Bot not found" }); return; }
    res.json(serializeBot(updated[0]));
  } catch (err) {
    req.log.error({ err }, "Error updating bot");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
