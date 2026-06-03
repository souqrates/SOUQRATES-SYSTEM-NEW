import { Router } from "express";
import { db } from "@workspace/db";
import { subagentApplicationsTable, usersTable, transactionsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../lib/auth";

/** Thrown inside the transfer transaction when the sender lacks funds. */
class InsufficientFundsError extends Error {}

const router = Router();

function serializeApplication(a: typeof subagentApplicationsTable.$inferSelect) {
  return {
    id: a.id,
    userId: a.userId,
    telegramId: a.telegramId,
    fullName: a.fullName,
    phone: a.phone,
    email: a.email,
    company: a.company,
    country: a.country,
    address: a.address,
    experience: a.experience,
    motivation: a.motivation,
    status: a.status,
    reviewNote: a.reviewNote,
    reviewedAt: a.reviewedAt ? a.reviewedAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  };
}

// POST /api/subagent/apply
router.post("/apply", requireAuth, async (req, res) => {
  const { fullName, phone, email, company, country, address, experience, motivation } = req.body;
  if (!fullName || !phone || !email || !country || !address || !experience || !motivation) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  // Identity is derived from the authenticated user, never the client body.
  const telegramId = req.auth!.telegramId;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const existing = await db
      .select()
      .from(subagentApplicationsTable)
      .where(eq(subagentApplicationsTable.telegramId, telegramId))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Application already exists", application: serializeApplication(existing[0]) });
      return;
    }
    const inserted = await db
      .insert(subagentApplicationsTable)
      .values({ userId: user.id, telegramId, fullName, phone, email, company: company || null, country, address, experience, motivation })
      .returning();
    res.json(serializeApplication(inserted[0]));
  } catch (err) {
    req.log.error({ err }, "Error submitting subagent application");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/subagent/me
router.get("/me", requireAuth, async (req, res) => {
  // Identity is derived from the authenticated user, never the client query.
  const telegramId = req.auth!.telegramId;
  try {
    const apps = await db
      .select()
      .from(subagentApplicationsTable)
      .where(eq(subagentApplicationsTable.telegramId, telegramId))
      .limit(1);
    if (apps.length === 0) { res.status(404).json({ error: "No application found" }); return; }
    const app = apps[0];
    let skzBalance: number | undefined;
    if (app.status === "approved") {
      const user = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);
      if (user.length > 0) skzBalance = Number(user[0].skzBalance);
    }
    res.json({ application: serializeApplication(app), ...(skzBalance !== undefined ? { skzBalance } : {}) });
  } catch (err) {
    req.log.error({ err }, "Error fetching subagent status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/subagent/transfer
router.post("/transfer", requireAuth, async (req, res) => {
  const { toTelegramId, amount, note } = req.body;
  // Sender is always the authenticated user, never taken from the client body.
  const fromTelegramId = req.auth!.telegramId;
  if (!toTelegramId || typeof amount !== "number" || amount <= 0) {
    res.status(400).json({ error: "Invalid transfer data" });
    return;
  }
  if (fromTelegramId === toTelegramId) {
    res.status(400).json({ error: "Cannot transfer to yourself" });
    return;
  }
  try {
    // Verify sender is an approved subagent
    const app = await db
      .select()
      .from(subagentApplicationsTable)
      .where(and(eq(subagentApplicationsTable.telegramId, fromTelegramId), eq(subagentApplicationsTable.status, "approved")))
      .limit(1);
    if (app.length === 0) {
      res.status(403).json({ error: "Not an approved subagent" });
      return;
    }
    // Get sender and recipient
    const [sender] = await db.select().from(usersTable).where(eq(usersTable.telegramId, fromTelegramId)).limit(1);
    const [recipient] = await db.select().from(usersTable).where(eq(usersTable.telegramId, toTelegramId)).limit(1);
    if (!sender) { res.status(404).json({ error: "Sender not found" }); return; }
    if (!recipient) { res.status(404).json({ error: "Recipient not found" }); return; }

    const txNote = note || `Subagent transfer from ${fromTelegramId}`;
    const outTx = await db.transaction(async (tx) => {
      // Atomic debit: only succeeds if the sender still has the funds. This
      // conditional update is the guard against concurrent double-spends.
      const debited = await tx
        .update(usersTable)
        .set({ skzBalance: sql`${usersTable.skzBalance} - ${amount}` })
        .where(and(eq(usersTable.id, sender.id), sql`${usersTable.skzBalance} >= ${amount}`))
        .returning({ id: usersTable.id });
      if (debited.length === 0) throw new InsufficientFundsError();

      await tx
        .update(usersTable)
        .set({ skzBalance: sql`${usersTable.skzBalance} + ${amount}` })
        .where(eq(usersTable.id, recipient.id));

      const [out] = await tx.insert(transactionsTable).values({
        userId: sender.id,
        type: "transfer_out",
        amount: amount.toFixed(6),
        status: "confirmed",
        note: txNote,
        refUserId: recipient.id,
      }).returning();
      await tx.insert(transactionsTable).values({
        userId: recipient.id,
        type: "transfer_in",
        amount: amount.toFixed(6),
        status: "confirmed",
        note: txNote,
        refUserId: sender.id,
      });
      return out;
    });

    res.json({
      id: outTx.id,
      type: outTx.type,
      amount: Number(outTx.amount),
      status: outTx.status,
      note: outTx.note,
      createdAt: outTx.createdAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }
    req.log.error({ err }, "Error processing subagent transfer");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/subagent/transfers
router.get("/transfers", requireAuth, async (req, res) => {
  // Identity is derived from the authenticated user, never the client query.
  const telegramId = req.auth!.telegramId;
  try {
    const app = await db
      .select()
      .from(subagentApplicationsTable)
      .where(and(eq(subagentApplicationsTable.telegramId, telegramId), eq(subagentApplicationsTable.status, "approved")))
      .limit(1);
    if (app.length === 0) { res.status(403).json({ error: "Not an approved subagent" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const txs = await db
      .select()
      .from(transactionsTable)
      .where(and(eq(transactionsTable.userId, user.id), eq(transactionsTable.type, "transfer_out")))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(50);
    res.json(txs.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: Number(tx.amount),
      status: tx.status,
      note: tx.note,
      currency: tx.currency,
      createdAt: tx.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Error fetching subagent transfers");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/subagent-applications
router.get("/admin-applications", requireAdmin, async (req, res) => {
  try {
    const apps = await db
      .select()
      .from(subagentApplicationsTable)
      .orderBy(desc(subagentApplicationsTable.createdAt));
    res.json(apps.map(serializeApplication));
  } catch (err) {
    req.log.error({ err }, "Error listing subagent applications");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/subagent/admin-applications/:id
router.patch("/admin-applications/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
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
    res.json(serializeApplication(updated[0]));
  } catch (err) {
    req.log.error({ err }, "Error reviewing subagent application");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
