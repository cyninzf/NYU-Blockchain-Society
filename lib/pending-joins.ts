import "server-only";
import { desc, eq } from "drizzle-orm";
import { auditRow } from "./admin";
import { recordCheckin } from "./checkin";
import type { Db } from "./db";
import { adminAudit, events, pendingJoins, type PendingJoin } from "./db/schema";
import { upsertMember } from "./member-join";

// Joins and check-in quick joins the bot guard flagged (round 20): kept here, never in members,
// so no count, block number, email or contact link sees them until a super admin says "Not spam".

export type NewPendingJoin = Omit<PendingJoin, "id" | "createdAt">;

export async function savePendingJoin(db: Db, p: NewPendingJoin) {
  const [row] = await db.insert(pendingJoins).values(p).returning({ id: pendingJoins.id });
  return row.id;
}

/** Newest first, with the event title for check-in joins. */
export const listPendingJoins = (db: Db) =>
  db.select({ p: pendingJoins, eventTitle: events.title }).from(pendingJoins).leftJoin(events, eq(events.id, pendingJoins.eventId)).orderBy(desc(pendingJoins.id));

/**
 * "Not spam" (super admins, checked by the caller): the pending row is removed (claimed once) and
 * the person joins through the normal path: upsertMember sends the welcome email to a new member
 * and links contacts. A check-in join of a new member is also checked in (method admin, by the
 * approving admin); an existing email is never checked in this way, as at the event. `join` is
 * replaceable for tests. Logged without personal data.
 */
export async function approvePendingJoin(db: Db, id: number, actor: string, join = upsertMember): Promise<number | null> {
  const [p] = await db.delete(pendingJoins).where(eq(pendingJoins.id, id)).returning();
  if (!p) return null;
  const row = await join(db, { name: p.name, email: p.email, affiliation: p.affiliation, blocks: p.blocks, notify: p.notify, src: p.source }, p.notify[0] ?? null);
  if (p.kind === "checkin" && p.eventId && row.inserted) await recordCheckin(db, p.eventId, row.id, "admin", actor);
  await db.insert(adminAudit).values(auditRow(actor, "pending.not_spam", `Approved pending ${p.kind === "checkin" ? "check-in join" : "join"} #${id} as member #${row.id}`, { memberId: row.id }));
  return row.id;
}

/** Delete (super admins, checked by the caller). Logged without personal data. */
export async function deletePendingJoin(db: Db, id: number, actor: string): Promise<boolean> {
  const [gone] = await db.delete(pendingJoins).where(eq(pendingJoins.id, id)).returning({ id: pendingJoins.id });
  if (gone) await db.insert(adminAudit).values(auditRow(actor, "pending.delete", `Deleted pending join #${id}`));
  return Boolean(gone);
}
