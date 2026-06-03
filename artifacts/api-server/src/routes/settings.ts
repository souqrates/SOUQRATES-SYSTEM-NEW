import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { UpdateSettingsBody } from "@workspace/api-zod";
import { requireAdmin } from "../lib/auth";

const router = Router();

function serializeSettings(s: typeof settingsTable.$inferSelect) {
  return {
    id: s.id,
    skzPerTon: parseFloat(s.skzPerTon),
    skzPerUsdt: parseFloat(s.skzPerUsdt),
    level1Rate: parseFloat(s.level1Rate),
    level2Rate: parseFloat(s.level2Rate),
    level3Rate: parseFloat(s.level3Rate),
    minDeposit: parseFloat(s.minDeposit),
    maxWithdraw: parseFloat(s.maxWithdraw),
    maintenanceMode: s.maintenanceMode,
    maintenanceMsg: s.maintenanceMsg,
    botToken: s.botToken ? "configured" : "",
    welcomeMessage: s.welcomeMessage,
    updatedAt: s.updatedAt.toISOString(),
  };
}

// GET /api/settings
router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(settingsTable).limit(1);
    if (rows.length === 0) {
      // Create default settings
      const inserted = await db.insert(settingsTable).values({}).returning();
      res.json(serializeSettings(inserted[0]));
      return;
    }
    res.json(serializeSettings(rows[0]));
  } catch (err) {
    req.log.error({ err }, "Error fetching settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/settings
router.patch("/", requireAdmin, async (req, res) => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  try {
    const existing = await db.select().from(settingsTable).limit(1);
    if (existing.length === 0) {
      const inserted = await db.insert(settingsTable).values(parsed.data as any).returning();
      res.json(serializeSettings(inserted[0]));
      return;
    }
    const updated = await db.update(settingsTable).set(parsed.data as any).returning();
    res.json(serializeSettings(updated[0]));
  } catch (err) {
    req.log.error({ err }, "Error updating settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
