import { db, usersTable, transactionsTable, settingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

/**
 * A database executor: either the root `db` connection or a transaction handle
 * passed by `db.transaction(async (tx) => ...)`. Both expose the same query API.
 */
export type Executor = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function getSettings() {
  const rows = await db.select().from(settingsTable).limit(1);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Credit referral commissions up to 3 levels deep for a SKZ-generating action.
 * Must run inside the same transaction as the originating balance change so a
 * partial failure rolls back the whole chain.
 */
export async function processReferralCommissions(
  executor: Executor,
  userId: number,
  skzAmount: number,
  settings: typeof settingsTable.$inferSelect | null,
  sourceNote = "purchase"
) {
  const level1Rate = settings ? parseFloat(settings.level1Rate) / 100 : 0.10;
  const level2Rate = settings ? parseFloat(settings.level2Rate) / 100 : 0.05;
  const level3Rate = settings ? parseFloat(settings.level3Rate) / 100 : 0.02;

  const user = await executor.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (user.length === 0 || !user[0].referredBy) return;

  // Level 1
  const ref1 = await executor.select().from(usersTable).where(eq(usersTable.id, user[0].referredBy)).limit(1);
  if (ref1.length > 0) {
    const commission1 = skzAmount * level1Rate;
    await executor.update(usersTable).set({
      skzBalance: sql`${usersTable.skzBalance} + ${commission1}`,
      totalEarned: sql`${usersTable.totalEarned} + ${commission1}`,
    }).where(eq(usersTable.id, ref1[0].id));
    await executor.insert(transactionsTable).values({
      userId: ref1[0].id,
      type: "commission",
      amount: commission1.toString(),
      status: "confirmed",
      note: `L1 commission from user ${userId} (${sourceNote})`,
      refUserId: userId,
    });

    // Level 2
    if (ref1[0].referredBy) {
      const ref2 = await executor.select().from(usersTable).where(eq(usersTable.id, ref1[0].referredBy)).limit(1);
      if (ref2.length > 0) {
        const commission2 = skzAmount * level2Rate;
        await executor.update(usersTable).set({
          skzBalance: sql`${usersTable.skzBalance} + ${commission2}`,
          totalEarned: sql`${usersTable.totalEarned} + ${commission2}`,
        }).where(eq(usersTable.id, ref2[0].id));
        await executor.insert(transactionsTable).values({
          userId: ref2[0].id,
          type: "commission",
          amount: commission2.toString(),
          status: "confirmed",
          note: `L2 commission from user ${userId} (${sourceNote})`,
          refUserId: userId,
        });

        // Level 3
        if (ref2[0].referredBy) {
          const ref3 = await executor.select().from(usersTable).where(eq(usersTable.id, ref2[0].referredBy)).limit(1);
          if (ref3.length > 0) {
            const commission3 = skzAmount * level3Rate;
            await executor.update(usersTable).set({
              skzBalance: sql`${usersTable.skzBalance} + ${commission3}`,
              totalEarned: sql`${usersTable.totalEarned} + ${commission3}`,
            }).where(eq(usersTable.id, ref3[0].id));
            await executor.insert(transactionsTable).values({
              userId: ref3[0].id,
              type: "commission",
              amount: commission3.toString(),
              status: "confirmed",
              note: `L3 commission from user ${userId} (${sourceNote})`,
              refUserId: userId,
            });
          }
        }
      }
    }
  }
}
