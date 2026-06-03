import { db, usersTable, transactionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { processReferralCommissions, getSettings } from "./referralCommissions";

export type ConfirmResult =
  | { status: "confirmed"; tx: typeof transactionsTable.$inferSelect }
  | { status: "already_confirmed"; tx: typeof transactionsTable.$inferSelect }
  | { status: "rejected"; tx: typeof transactionsTable.$inferSelect }
  | { status: "not_found" };

/**
 * Atomically confirm a pending deposit: flip status pending -> confirmed,
 * credit the recorded SKZ amount to the depositor, and run referral
 * commissions in the same transaction.
 *
 * The confirmation is idempotent: the status flip uses a conditional
 * `WHERE status = 'pending'` update, so a second confirm of the same deposit
 * is a no-op (returns `already_confirmed`) and never double-credits.
 *
 * The actual on-chain verification (that `txHash` really paid `amount`) is the
 * responsibility of the trusted caller (the chain indexer/webhook or an admin).
 */
export async function confirmDeposit(
  selector: { transactionId: number } | { txHash: string }
): Promise<ConfirmResult> {
  return db.transaction(async (tx) => {
    const matchCond =
      "transactionId" in selector
        ? eq(transactionsTable.id, selector.transactionId)
        : eq(transactionsTable.txHash, selector.txHash);

    const existing = await tx
      .select()
      .from(transactionsTable)
      .where(and(matchCond, eq(transactionsTable.type, "deposit")))
      .limit(1);

    if (existing.length === 0) return { status: "not_found" } as const;
    const deposit = existing[0];

    if (deposit.status === "confirmed") return { status: "already_confirmed", tx: deposit } as const;
    if (deposit.status === "failed") return { status: "rejected", tx: deposit } as const;

    // Conditional flip — idempotency + concurrency guard. Only one caller wins.
    const [flipped] = await tx
      .update(transactionsTable)
      .set({ status: "confirmed" })
      .where(and(eq(transactionsTable.id, deposit.id), eq(transactionsTable.status, "pending")))
      .returning();
    if (!flipped) {
      // Someone else confirmed it between our read and write.
      return { status: "already_confirmed", tx: deposit } as const;
    }

    const skzAmount = parseFloat(flipped.amount);
    await tx
      .update(usersTable)
      .set({ skzBalance: sql`${usersTable.skzBalance} + ${skzAmount}` })
      .where(eq(usersTable.id, flipped.userId));

    const settings = await getSettings();
    await processReferralCommissions(tx, flipped.userId, skzAmount, settings, "deposit");

    return { status: "confirmed", tx: flipped } as const;
  });
}

/**
 * Mark a pending deposit as failed/rejected. Idempotent and never touches
 * balances. Returns false if the deposit was already settled (confirmed).
 */
export async function rejectDeposit(
  selector: { transactionId: number } | { txHash: string }
): Promise<{ status: "rejected" | "already_confirmed" | "not_found"; tx?: typeof transactionsTable.$inferSelect }> {
  const matchCond =
    "transactionId" in selector
      ? eq(transactionsTable.id, selector.transactionId)
      : eq(transactionsTable.txHash, selector.txHash);

  const existing = await db
    .select()
    .from(transactionsTable)
    .where(and(matchCond, eq(transactionsTable.type, "deposit")))
    .limit(1);
  if (existing.length === 0) return { status: "not_found" };
  if (existing[0].status === "confirmed") return { status: "already_confirmed", tx: existing[0] };

  const [updated] = await db
    .update(transactionsTable)
    .set({ status: "failed" })
    .where(and(eq(transactionsTable.id, existing[0].id), eq(transactionsTable.status, "pending")))
    .returning();
  return { status: "rejected", tx: updated ?? existing[0] };
}
