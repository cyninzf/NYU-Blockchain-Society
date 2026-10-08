import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { Db } from "./db";
import { rateLimitHits } from "./db/schema";

// Signing key for form tokens and IP hashes. FORM_SECRET is optional; DATABASE_URL is
// already a per-environment secret, so it's a safe fallback.
const secret = () => process.env.FORM_SECRET || process.env.DATABASE_URL || "dev-only-secret";

export const hmac = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** `payload.signature`, verified in constant time. */
export const sign = (payload: string) => `${payload}.${hmac(payload)}`;
export function verify(token: string): string | null {
  const i = token.lastIndexOf(".");
  if (i < 1) return null;
  const payload = token.slice(0, i);
  return safeEqual(token.slice(i + 1), hmac(payload)) ? payload : null;
}

/** HMAC of the client IP. The raw IP is never stored or logged. */
export async function ipKey(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return hmac(`ip:${ip}`).slice(0, 32);
}

/** Lightweight Postgres-backed limiter: at most `limit` hits per `windowSec` per key. */
export async function rateLimited(db: Db, action: string, limit: number, windowSec: number): Promise<boolean> {
  const key = `${action}:${await ipKey()}`;
  const since = sql`now() - make_interval(secs => ${windowSec})`;
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(rateLimitHits)
    .where(and(eq(rateLimitHits.key, key), gt(rateLimitHits.createdAt, since)));
  if (n >= limit) return true;
  await db.insert(rateLimitHits).values({ key });
  // Occasionally prune old hits so the table stays small.
  if (Math.random() < 0.05) await db.delete(rateLimitHits).where(lt(rateLimitHits.createdAt, sql`now() - interval '1 day'`));
  return false;
}
