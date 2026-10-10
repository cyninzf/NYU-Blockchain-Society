import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { CLOSES_AFTER_H, OPENS_BEFORE_H } from "./checkin";
import type { Db } from "./db";
import { displayLinks, events } from "./db/schema";

// Display links (round 12.1): the live screen without signing in, for a TV in the room. A
// 256-bit random token; only its SHA-256 is stored and the full URL is shown once, when created.

const hash = (raw: string) => createHash("sha256").update(raw).digest("base64url");

export async function createDisplayLink(db: Db, eventId: number, actor: string): Promise<{ id: number; token: string }> {
  const token = randomBytes(32).toString("base64url");
  const [row] = await db.insert(displayLinks).values({ eventId, tokenHash: hash(token), createdBy: actor }).returning({ id: displayLinks.id });
  return { id: row.id, token };
}

export type DisplayAccess = { ok: true; eventId: number; title: string } | { ok: false; reason: "invalid" | "closed" };

/**
 * Whether `raw` opens the live screen of the event `slug` right now: a live (not revoked) link
 * for that very event, the event published, and check-in open (3 hours before the start until
 * 2 hours after the end). Looked up by hash, so nothing is compared in plaintext.
 */
export async function displayAccess(db: Db, slug: string, raw: string): Promise<DisplayAccess> {
  if (!/^[\w-]{40,60}$/.test(raw)) return { ok: false, reason: "invalid" };
  const [r] = await db.select({
    eventId: events.id, title: events.title,
    open: sql<boolean>`now() between ${events.startsAt} - ${sql.raw(`interval '${OPENS_BEFORE_H} hours'`)}
      and coalesce(${events.endsAt}, ${events.startsAt}) + ${sql.raw(`interval '${CLOSES_AFTER_H} hours'`)}`,
  }).from(displayLinks).innerJoin(events, eq(events.id, displayLinks.eventId))
    .where(and(eq(displayLinks.tokenHash, hash(raw)), isNull(displayLinks.revokedAt), eq(events.slug, slug), eq(events.status, "published")));
  if (!r) return { ok: false, reason: "invalid" };
  return r.open ? { ok: true, eventId: r.eventId, title: r.title } : { ok: false, reason: "closed" };
}
