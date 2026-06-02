# Souqrates System

Central Telegram Mini App for the Souqrates ecosystem — managing SKZ virtual currency, multi-level referrals, and access to sub-bots.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/souqrates run dev` — run the Mini App frontend (port 19714)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Wouter routing, TanStack Query, Tailwind CSS, Orbitron font
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/` — DB tables: users, transactions, bots, settings
- `artifacts/api-server/src/routes/` — Express route handlers (users, wallet, referrals, bots, admin, settings)
- `artifacts/souqrates/src/` — React Mini App frontend
  - `pages/home.tsx` — Dashboard with animated SKZ balance
  - `pages/wallet.tsx` — Deposit (TON/USDT), transfer, history
  - `pages/referrals.tsx` — Referral tree, earnings, leaderboard
  - `pages/bots.tsx` — Sub-bot cards
  - `pages/manager/` — Full admin panel (/manager route)

## Architecture decisions

- **SKZ currency**: All balances stored as `numeric(18,6)` for precision. Rates (SKZ/TON, SKZ/USDT) managed in `settings` table by admin.
- **3-level referral commissions**: Processed synchronously on deposit. Rates are configurable from /manager panel. L1 gets the highest cut, L2 and L3 get decreasing percentages.
- **Single shared wallet**: One `users.skz_balance` field used across all sub-bots. Sub-bots share the same DB.
- **Demo user**: `telegramId: demo_user_001` auto-registered on first page load via localStorage. Admin user: `telegramId: admin_001`.
- **Hosting strategy**: Backend hosted on Contabo (export build and run there), Replit used only for development/editing.

## Product

- **Souqrates System** (this repo) — central hub: wallet, referrals, sub-bot gateway, admin panel
- **Souqrates Skillz** — skill-based paid games with prizes (future)
- **Souqrates Souq** — digital books marketplace (future)
- **Souqrates Subagent** — partner platform for SKZ trading (future)

## User preferences

- All UI text uses ORBITON / Orbitron font (futuristic, wide-tracking)
- Dark mode as default (deep space blacks, electric purple accents, gold SKZ balance)
- No emojis in UI text
- Professional, high-tech financial platform aesthetic

## Gotchas

- Referral commissions run 3 levels deep on every confirmed deposit — test with small amounts
- Settings row must exist before rates are used (auto-created on first GET /api/settings)
- Bot userCount is manually managed — no auto-sync from sub-bots yet
- Commission level identified by `note` field prefix (L1/L2/L3) — don't change the prefix format

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- API routes follow the OpenAPI spec in `lib/api-spec/openapi.yaml`
- Run codegen after any spec change: `pnpm --filter @workspace/api-spec run codegen`
