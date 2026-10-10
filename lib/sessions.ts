import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import type { Db } from "./db";
import { authSessions } from "./db/schema";
import { readSession, signSession } from "./session-token";

import { reportError } from "./monitoring";
// Server-side sessions: the cookie is a signed random id; the row says who it is and whether it
// still counts. Revoking a row (sign-out, admin removed) ends the session at once.

type Kind = "admin" | "member";
const hash = (raw: string) => createHash("sha256").update(raw).digest("base64url");

/** A new session for `subject`; returns the cookie value, or null without AUTH_SECRET. */
export async function createSession(db: Db, kind: Kind, subject: string, ttlMs: number): Promise<string | null> {
  const raw = randomBytes(32).toString("base64url");
  const cookie = signSession(kind, raw, ttlMs);
  if (!cookie) return null;
  await db.insert(authSessions).values({ tokenHash: hash(raw), kind, subject, expiresAt: new Date(Date.now() + ttlMs) });
  // Occasionally prune long-expired rows.
  if (Math.random() < 0.05) await db.delete(authSessions).where(lt(authSessions.expiresAt, sql`now() - interval '7 days'`));
  return cookie;
}

/** Who a cookie belongs to, if its signature is valid and its session is live (not revoked or expired). */
export async function sessionSubject(db: Db | null, kind: Kind, cookie: string | undefined): Promise<string | null> {
  // Only inside a real request (round 18; moved first in round 20): during a prerender this never
  // resolves, so neither the expiry check (Date.now() in readSession) nor the query runs there.
  // In server actions and route handlers it resolves at once.
  await connection();
  const s = readSession(kind, cookie);
  if (!s || !db) return null;
  try {
    const [row] = await db.select({ subject: authSessions.subject }).from(authSessions)
      .where(and(eq(authSessions.tokenHash, hash(s.subject)), eq(authSessions.kind, kind), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, sql`now()`)));
    return row?.subject ?? null;
  } catch (e) {
    // Next.js's own control-flow errors (e.g. a prerender ending) aren't failures: let Next handle them.
    unstable_rethrow(e);
    reportError("admin", "session lookup failed", e);
    return null;
  }
}

/** Sign-out: this cookie's session stops working everywhere, even if the cookie was copied. */
export async function revokeSession(db: Db, kind: Kind, cookie: string | undefined) {
  const s = readSession(kind, cookie);
  if (s) await db.update(authSessions).set({ revokedAt: new Date() }).where(and(eq(authSessions.tokenHash, hash(s.subject)), eq(authSessions.kind, kind)));
}

/** Every live session of one admin or member (e.g. an admin removed from the team). */
export const revokeAllFor = (db: Db, kind: Kind, subject: string) =>
  db.update(authSessions).set({ revokedAt: new Date() }).where(and(eq(authSessions.kind, kind), eq(authSessions.subject, subject), isNull(authSessions.revokedAt)));
