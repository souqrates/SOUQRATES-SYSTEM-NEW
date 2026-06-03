---
name: Detecting Postgres unique violations through Drizzle
description: Why mapping a duplicate-key error to HTTP 409 must check err.cause and the pg code, not just err.message
---

# Detecting Postgres unique violations through Drizzle

When an insert hits a unique constraint, the pg driver raises an error with
SQLSTATE `code === "23505"`. **Drizzle (drizzle-orm with node-postgres) may wrap
that driver error**, leaving the original (with the `code`) on `err.cause` rather
than the top-level error. A handler that only regex-matches `err.message` for
"duplicate key" / the constraint name will miss the wrapped case and fall through
to a generic 500.

**Why:** this exact bug shipped once — duplicate `txHash` deposit returned 500
instead of the intended 409 because the message check didn't fire on the wrapped
error.

**How to apply:** detect unique violations by checking the pg code on BOTH the
error and its cause (`e.code === "23505" || e.cause?.code === "23505"`), and keep a
message-regex fallback. See `isUniqueViolation()` in
`artifacts/api-server/src/routes/wallet.ts` for the canonical helper to reuse/copy.
