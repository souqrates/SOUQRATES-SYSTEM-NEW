---
name: Games system architecture
description: Souqrates Skillz — 50 skill games with 5 ticket tiers each, Canvas gameplay engine, full admin panel.
---

**Rule:** The games system is complete and self-contained. No developer intervention needed for game management — all done from /manager/games.

**Why:** Built for Souqrates ecosystem to provide skill-based paid games with SKZ currency prizes.

**Architecture:**
- DB tables: `skillz_games`, `game_tickets`, `game_sessions` (in lib/db/src/schema/games.ts)
- API routes: `artifacts/api-server/src/routes/games.ts`, registered at `/api/games`
- Seed script: `scripts/src/seed-games.ts` — run with `pnpm --filter @workspace/scripts run seed-games`
- Frontend: `artifacts/souqrates-skillz/` — Lobby, GameDetail, Play (Canvas), History, Leaderboard pages
- Admin: `artifacts/souqrates/src/pages/manager/games.tsx` — toggle active, edit all ticket params

**Gameplay engine (play.tsx):**
- Reads game category to pick engine: Reflex/Aim → tap targets, Timing → hit bar zone, Pattern → Simon Says, Physics → gravity flip survival
- All engines: Canvas 2D + requestAnimationFrame loop, Web Audio API tones, particle effects
- Session flow: select ticket → startGameSession (deducts SKZ) → play → endGameSession (awards prize if won)
- TARGET LINE = ticket.targetScore; progress bar shows score vs target in real time

**Ticket tiers (per game):**
- Tier 1 Bronze: lowest entry/prize
- Tier 5 Diamond: highest entry/prize, hardest target, least time
- All tiers configurable from /manager/games without code changes
