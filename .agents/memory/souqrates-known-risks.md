---
name: Souqrates deposit & scoring security posture
description: Current state of the two money-loss vectors in the Souqrates API (deposits, game payouts) — what is now enforced and what residual risk remains
---

# Souqrates deposit & scoring security posture

Both historical money-loss vectors have been hardened. This file records the
**invariants you must not regress** and the **residual risk** that is accepted.

## 1. Deposits — credit only on confirmation
`POST /wallet/deposit` creates a `status: "pending"` row and does **NOT** credit
SKZ or run commissions. Crediting happens exactly once, atomically, only via the
shared confirm logic (`lib/depositConfirm.ts`), reached through two paths:
- the secured webhook `POST /wallet/deposit/confirm` (DEPOSIT_WEBHOOK_SECRET header,
  timing-safe compare; returns 503 until the secret is set), or
- admin manual confirm/reject (requireAdmin).
Replay/double-submit is blocked by a **partial unique index on `transactions.tx_hash`
(where not null)**; a duplicate submit returns 409.

**Invariant — do not regress:** never re-add immediate credit to the deposit POST.
The deposit endpoint records intent only; money moves on confirm.

## 2. Game payouts — server-authoritative scoring
Score is tallied server-side from `POST /games/session/:id/event` (combo+score math
lives on the server, mirrors client feel). `POST /games/session/:id/end` **ignores the
client-reported finalScore/won** and decides `won = session.score >= targetScore`.
End is idempotent (no double payout). Event handler enforces ownership, active status,
a time window (startedAt + timeLimit + grace), a rate cap (MIN_EVENT_INTERVAL_MS), and
clamps a tampered `points` to `[1, correctHitValue + bonus]`.

**Concurrency:** the event transaction takes a row lock (`SELECT ... FOR UPDATE`) on the
session before reading/writing score/combo/lastEventAt. Without it, concurrent events
read stale state and the throttle/combo math suffers lost updates. The lock is what makes
the rate cap effective against parallel bursts — keep it.

**Residual risk (accepted):** the event endpoint still trusts that a reported `correct`
hit actually happened — a sophisticated bot can POST well-paced fake `correct:true` events
and farm prizes (prizes exceed entry fees). Eliminating this needs signed/replayable event
proofs or a server-side deterministic simulation. Do not claim payouts are bot-proof.
The throttle may also slightly undercount continuous-distance game engines (events outside
the min interval are dropped as no-ops).

## Deploy note
Prod runs on Contabo (drizzle `push` is dev-only). The schema changes here — the
`transactions.tx_hash` partial unique index and `game_sessions.combo` / `last_event_at`
columns — must be applied manually to the prod DB before rollout, and DEPOSIT_WEBHOOK_SECRET
set in prod, or confirm-via-webhook stays 503.
