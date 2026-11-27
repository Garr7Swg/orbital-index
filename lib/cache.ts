import { Redis } from "@upstash/redis";

/**
 * Two-level cache: in-process memory (always) + Upstash Redis (optional).
 * Every remote call is wrapped so a Redis outage can never break a page.
 */
const memory = new Map<string, { value: unknown; expires: number }>();

function redisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis === undefined) redis = redisClient();
  return redis;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  if (hit) memory.delete(key);

  const client = getRedis();
  if (client) {
    try {
      const value = await client.get<T>(key);
      if (value !== null && value !== undefined) return value;
    } catch {
      // Redis is a best-effort layer; ignore failures.
    }
  }
  return null;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  memory.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  const client = getRedis();
  if (client) {
    try {
      await client.set(key, value, { ex: ttlSeconds });
    } catch {
      // ignore
    }
  }
}

export function cacheDelete(key: string) {
  memory.delete(key);
}

export function cacheConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}
