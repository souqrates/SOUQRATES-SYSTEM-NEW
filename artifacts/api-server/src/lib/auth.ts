import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const IS_PROD = process.env["NODE_ENV"] === "production";

// Telegram WebApp initData stays valid for a bounded window. Reject anything older.
const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

export type AuthContext = {
  telegramId: string;
  verified: boolean; // true when a real Telegram HMAC signature was validated
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

// ── Bot token cache ────────────────────────────────────────────────────────
// Tokens may live in env vars and/or the settings table. Cache them briefly so
// every request does not hit the DB.

let cachedTokens: string[] = [];
let cacheExpiry = 0;
const TOKEN_CACHE_MS = 30_000;

function envTokens(): string[] {
  return [
    process.env["SYSTEM_BOT_TOKEN"],
    process.env["SUBAGENT_BOT_TOKEN"],
    process.env["SKILLZ_BOT_TOKEN"],
    process.env["SOUQ_BOT_TOKEN"],
  ].filter((t): t is string => Boolean(t && t.trim()));
}

async function getBotTokens(): Promise<string[]> {
  const now = Date.now();
  if (now < cacheExpiry && cachedTokens.length > 0) return cachedTokens;

  const tokens = new Set<string>(envTokens());
  try {
    const rows = await db.select().from(settingsTable).limit(1);
    const s = rows[0];
    if (s) {
      for (const t of [s.systemBotToken, s.subagentBotToken, s.skillzBotToken, s.souqBotToken]) {
        if (t && t.trim()) tokens.add(t.trim());
      }
    }
  } catch {
    // settings unavailable — fall back to env tokens only
  }

  cachedTokens = [...tokens];
  cacheExpiry = now + TOKEN_CACHE_MS;
  return cachedTokens;
}

// ── initData validation ────────────────────────────────────────────────────

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * Validate a Telegram WebApp initData string against a single bot token.
 * Returns the verified telegram user id, or null when invalid.
 * Algorithm: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function validateAgainstToken(initData: string, botToken: string): string | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!timingSafeEqualHex(computed, hash)) return null;

  // Reject stale auth payloads.
  const authDate = Number(params.get("auth_date"));
  if (authDate && Number.isFinite(authDate)) {
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (ageSeconds > MAX_AUTH_AGE_SECONDS) return null;
  }

  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    const user = JSON.parse(userRaw) as { id?: number };
    if (typeof user.id !== "number") return null;
    return String(user.id);
  } catch {
    return null;
  }
}

async function validateInitData(initData: string): Promise<string | null> {
  const tokens = await getBotTokens();
  for (const token of tokens) {
    const id = validateAgainstToken(initData, token);
    if (id) return id;
  }
  return null;
}

// ── Middleware ─────────────────────────────────────────────────────────────

/**
 * Attaches `req.auth` when a valid Telegram initData header is present.
 * In development (NODE_ENV !== production) it falls back to an unverified
 * demo identity so the Replit preview keeps working without real Telegram.
 */
export async function attachAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const initData = req.header("x-telegram-init-data");
  if (initData) {
    const telegramId = await validateInitData(initData);
    if (telegramId) {
      req.auth = { telegramId, verified: true };
      next();
      return;
    }
  }

  if (!IS_PROD) {
    const demoId = req.header("x-demo-telegram-id") || "demo_user_001";
    req.auth = { telegramId: demoId, verified: false };
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

function configuredAdminIds(): string[] {
  const fromEnv = (process.env["ADMIN_TELEGRAM_IDS"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!IS_PROD) {
    fromEnv.push("demo_user_001", "admin_001");
  }
  return fromEnv;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { telegramId } = req.auth;
  if (configuredAdminIds().includes(telegramId)) {
    next();
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);
    if (user?.isAdmin) {
      next();
      return;
    }
  } catch (err) {
    req.log.error({ err }, "requireAdmin lookup failed");
  }

  res.status(403).json({ error: "Admin access required" });
}

export function invalidateTokenCache(): void {
  cacheExpiry = 0;
  cachedTokens = [];
}
