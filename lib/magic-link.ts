import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "./db";
import { authTokens } from "./db/schema";

/** Magic links work once and expire after 15 minutes. */
export const LINK_TTL_MS = 15 * 60 * 1000;
type Purpose = "admin" | "member";

const hash = (raw: string) => createHash("sha256").update(raw).digest("base64url");

/** A new single-use token for `subject`. Only its hash is stored. */
export async function createLinkToken(db: Db, purpose: Purpose, subject: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await db.insert(authTokens).values({ tokenHash: hash(raw), purpose, subject, expiresAt: new Date(Date.now() + LINK_TTL_MS) });
  // Occasionally prune old tokens so the table stays small.
  if (Math.random() < 0.1) await db.delete(authTokens).where(lt(authTokens.createdAt, sql`now() - interval '2 days'`));
  return raw;
}

/**
 * Marks the token used and returns its subject, in one statement, so it can never work twice.
 * The lookup is by SHA-256 of a 256-bit random token: an attacker can't steer the hash, so the
 * index comparison leaks nothing useful (no plaintext compare happens anywhere). On success,
 * every other unused link for the same person is spent too.
 */
export async function consumeLinkToken(db: Db, purpose: Purpose, raw: string): Promise<string | null> {
  if (!/^[\w-]{20,100}$/.test(raw)) return null;
  const [row] = await db.update(authTokens).set({ usedAt: new Date() })
    .where(and(eq(authTokens.tokenHash, hash(raw)), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt), gt(authTokens.expiresAt, sql`now()`)))
    .returning({ subject: authTokens.subject });
  if (row) await db.update(authTokens).set({ usedAt: new Date() }).where(and(eq(authTokens.purpose, purpose), eq(authTokens.subject, row.subject), isNull(authTokens.usedAt)));
  return row?.subject ?? null;
}
