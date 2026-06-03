---
name: Souqrates known financial risks
description: Two accepted/unresolved money-loss vectors in the Souqrates API that look fine in code but need product/infra decisions
---

# Souqrates known financial risks

The auth/IDOR hardening pass closed all client-spoofed-identity holes (every sensitive
endpoint now uses `requireAuth` and derives the actor from `req.auth.telegramId`, never
from client body/query). Two deeper money-loss vectors remain that are NOT visible as bugs
in the code — they are design decisions awaiting an owner call:

## 1. Deposit minting (POST /api/wallet/deposit)
Deposits are written `status: "confirmed"` and credit SKZ immediately from the client
payload (`amount/currency/txHash`) with **no on-chain verification and no txHash
uniqueness/replay guard**. Any authenticated user can mint unlimited SKZ.

**Why unresolved:** real fix needs an off-chain verifier (TON/USDT webhook or chain
indexer) + unique `txHash` per network, only crediting on verified confirmation. That is
new infrastructure and a product decision, not a hardening edit.

**How to apply:** if asked to "secure deposits", do not just add atomicity — the credit
itself is unverified. Propose the verifier pipeline + unique txHash constraint first.

## 2. Game payout trusts client score (POST /api/games/session/:id/end)
Win is now server-derived (`won = finalScore >= session.targetScore`) and settlement is
atomic + double-settle-guarded + ownership-checked. But `finalScore` is still reported by
the client (canvas game runs client-side), and seeded prizes exceed entry fees, so a
cheater can post an inflated score and farm net-positive SKZ.

**Why unresolved:** eliminating this needs server-authoritative scoring (deterministic
server simulation / signed event proofs / anti-cheat), or making `prize <= entry`. Both
are product/economics decisions.

**How to apply:** treat client-reported score as untrusted. Don't claim payouts are
"secure" just because ownership + win-threshold checks exist.
