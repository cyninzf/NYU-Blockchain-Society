import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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

/**
 * Encrypted, authenticated tokens (AES-256-GCM): like `sign`, but the payload can't be read, so a
 * token never shows a member id (which would hint at the member count).
 */
const sealKey = () => createHash("sha256").update(`seal:${secret()}`).digest();
export function seal(payload: string): string {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", sealKey(), iv);
  const body = Buffer.concat([c.update(payload, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}
export function unseal(token: string): string | null {
  try {
    const b = Buffer.from(token, "base64url");
    if (b.length < 29) return null;
    const d = createDecipheriv("aes-256-gcm", sealKey(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** HMAC of the client IP. The raw IP is never stored or logged. */
export async function ipKey(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return hmac(`ip:${ip}`).slice(0, 32);
}

/** Lightweight Postgres-backed limiter: at most `limit` hits per `windowSec` per IP (hashed). */
export async function rateLimited(db: Db, action: string, limit: number, windowSec: number): Promise<boolean> {
  return rateLimitedKey(db, `${action}:${await ipKey()}`, limit, windowSec);
}

/** Per email: the key is an HMAC, so no address is stored. Counts whether or not the email exists. */
export const rateLimitedEmail = (db: Db, action: string, email: string, limit: number, windowSec: number) =>
  rateLimitedKey(db, `${action}:email:${hmac(`email:${email.trim().toLowerCase()}`).slice(0, 32)}`, limit, windowSec);

export async function rateLimitedKey(db: Db, key: string, limit: number, windowSec: number): Promise<boolean> {
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
