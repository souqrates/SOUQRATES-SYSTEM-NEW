---
name: Games system architecture
description: 50 games across 5 categories, 10 distinct Canvas engines, full admin at /manager/games.
---

**Categories (5):** Timing, Physics, Swipe, Memory, Strategy — 10 games each.

**10 Engine identities in play.tsx (getEngine slug→engine map):**
- rhythm: 3-lane note highway, golden hit bar, crypto symbols fall. Slugs: crypto-rhythm, heartbeat-sync, signal-surge…
- pendulum: spinning metallic dial with red target markers, tap needle-on-marker
- powerbar: vertical electric bar, oscillating needle, narrow shrinking green sweet spot
- meteor: colored meteors with fire trails fall, drag basket to match color
- laser: scrolling sci-fi corridor, 3 rows, laser gates with one open row per gate
- stack: classic sliding block stacker, trims excess, speeds up per block
- gravity: neon auto-runner tunnel, tap to flip gravity, wall obstacle gaps
- slasher: hex grid BG, objects arc across screen, pointer trail intersect detection
- simon: 3×4 grid of crypto symbols, show sequence → player repeats (setTimeout chain, cleanedUp guard)
- shield: circular arena, rotating 75° arc, tap L/R to rotate and deflect projectiles

**Architecture:**
- DB tables: `skillz_games`, `game_tickets`, `game_sessions` (lib/db/src/schema/games.ts)
- API routes: `artifacts/api-server/src/routes/games.ts`
- Seed: `scripts/src/seed-games.ts` — DELETES all sessions/tickets/games first, then re-seeds. Run: `pnpm --filter @workspace/scripts run seed-games`
- Frontend: `artifacts/souqrates-skillz/` — Lobby, GameDetail, Play, History, Leaderboard
- Admin: `artifacts/souqrates/src/pages/manager/games.tsx`

**Why:** Full visual/mechanical variety across all 50 games. Simon engine uses setTimeout chains (not RAF timing) with a `cleanedUp` boolean to prevent post-unmount callbacks.
