import { logger } from "./logger";

interface RedisClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: { ex?: number }) => Promise<string | null>;
  del: (key: string) => Promise<number>;
  ping: () => Promise<string>;
}

let _redis: RedisClient | null = null;

export function getRedis(): RedisClient | null {
  return _redis;
}

export async function initRedis(url: string, token: string) {
  try {
    const { Redis } = await import("@upstash/redis");
    _redis = new Redis({ url, token });
    // Ping to verify
    await _redis.ping();
    logger.info("Upstash Redis connected");
  } catch (err) {
    logger.warn({ err }, "Failed to initialize Upstash Redis — continuing without cache");
    _redis = null;
  }
}

export async function testRedis(url: string, token: string): Promise<{ ok: boolean; message: string }> {
  try {
    const { Redis } = await import("@upstash/redis");
    const client = new Redis({ url, token });
    const pong = await client.ping();
    if (pong === "PONG") {
      // Quick round-trip test
      await client.set("souqrates:test", "ok", { ex: 10 });
      const val = await client.get("souqrates:test");
      if (val === "ok") {
        return { ok: true, message: "Upstash Redis connected — SET/GET verified" };
      }
    }
    return { ok: false, message: "Ping succeeded but read/write test failed" };
  } catch (err) {
    return { ok: false, message: `Connection failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function testQStash(url: string, token: string): Promise<{ ok: boolean; message: string }> {
  try {
    const resp = await fetch(`${url}/v2/queues`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      return { ok: true, message: "Upstash QStash connected — API reachable" };
    }
    const body = await resp.text();
    return { ok: false, message: `QStash returned ${resp.status}: ${body.slice(0, 120)}` };
  } catch (err) {
    return { ok: false, message: `Connection failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// Generic cache helper
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!_redis) return null;
  try {
    const raw = await _redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60) {
  if (!_redis) return;
  try {
    await _redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } catch {
    // non-fatal
  }
}
