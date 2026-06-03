#!/usr/bin/env bash
#
# Souqrates production deploy script — run ON the Contabo server.
#
#   cd /var/www/souqrates && ./deploy.sh
#
# It pulls the latest code, installs deps, applies the required database
# migrations (idempotent), rebuilds, and restarts the API under PM2.
#
# Prerequisites (one time):
#   - DEPOSIT_WEBHOOK_SECRET must be present in /var/www/souqrates/.env
#     (otherwise the deposit-confirm webhook stays 503).
#
set -euo pipefail

APP_DIR="/var/www/souqrates"
DB_URL="${DATABASE_URL:-postgresql://souqrates:souq2026@localhost:5432/souqrates}"
PM2_APP="souqrates-api"

cd "$APP_DIR"

echo "==> [1/5] Pulling latest code"
git pull origin main

echo "==> [2/5] Installing dependencies"
pnpm install

echo "==> [3/5] Applying database migrations (idempotent)"
psql "$DB_URL" <<'SQL'
-- Deposit replay guard: unique tx_hash (only when set)
CREATE UNIQUE INDEX IF NOT EXISTS transactions_tx_hash_unique
  ON public.transactions USING btree (tx_hash)
  WHERE (tx_hash IS NOT NULL);

-- Server-authoritative scoring state on game sessions
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS combo integer NOT NULL DEFAULT 0;
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz;
SQL

echo "==> [4/5] Regenerating API client + building"
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/souqrates run build
pnpm --filter @workspace/souqrates-skillz run build
pnpm --filter @workspace/souqrates-souq run build || true
pnpm --filter @workspace/souqrates-subagent run build || true

echo "==> [5/5] Restarting PM2 (with env reload)"
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env
else
  echo "PM2 process '$PM2_APP' not found — start it manually the first time."
fi

echo
echo "==> Deploy complete. Quick health check:"
sleep 2
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://souqrates.com/api/wallet/deposit/confirm \
  -H "Content-Type: application/json" -d '{"txHash":"__healthcheck__"}' || true)
echo "    /wallet/deposit/confirm -> HTTP $code  (expect 401 = secret set; 503 = secret missing)"
