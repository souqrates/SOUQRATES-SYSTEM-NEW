---
name: OpenAPI Params collision fix
description: When an endpoint has both path params AND query params, Orval generates a *Params type in both generated/api.ts (Zod) and generated/types/ (TypeScript) causing TS2308 barrel collision.
---

**Rule:** Never mix path parameters AND query parameters on the same OpenAPI endpoint. If both are needed, move path params to query params instead.

**Why:** Orval generates `<OperationIdPascal>Params` as both a Zod schema (in generated/api.ts) and a TypeScript type (in generated/types/). Both are re-exported by the barrel index, causing `TS2308: Module has already exported a member`. Endpoints with ONLY path params OR ONLY query params do not trigger this.

**How to apply:** When writing new OpenAPI paths, check: does this endpoint have both `in: path` and `in: query` parameters? If yes, convert the path param to a query param (e.g. `/games/leaderboard?game_id=X` instead of `/games/leaderboard/{gameId}?limit=Y`).
