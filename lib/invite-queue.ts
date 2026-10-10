import "server-only";
import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { auditRow } from "./admin";
import type { Db } from "./db";
import { adminAudit, contacts, events, inviteCampaigns, inviteQueue } from "./db/schema";
import { emailConfigured, remainingToday, sendBatch } from "./email";
import { InviteDraft, inviteEmail, type FeaturedEvent } from "./invite-email";
import { eligibleWhere } from "./invites";
import { postalAddress } from "./settings";

// The invite queue (round 12). A campaign's contacts go out in daily slices: each run sends up
// to what's left of the shared daily email limit (minus a small reserve for sign-in links and
// welcome emails), and the daily cron (/api/cron/invites) picks up the rest until it's done.
// Rows are claimed atomically (FOR UPDATE SKIP LOCKED), so two runs never send the same invite.

/** Left for sign-in links, check-in links and welcome emails on a day invites are going out. */
export const INVITE_RESERVE = 10;
const CHUNK = 100;

export type RunResult = { sent: number; failed: number; skipped: number; note?: string };

/** The featured event, only while it's published and upcoming (otherwise the invite goes without it). */
async function featured(db: Db, eventId: number | null): Promise<FeaturedEvent | null> {
  if (!eventId) return null;
  const [e] = await db.select({ title: events.title, startsAt: events.startsAt, endsAt: events.endsAt, venueName: events.venueName }).from(events)
    .where(and(eq(events.id, eventId), eq(events.status, "published"), gt(sql`coalesce(${events.endsAt}, ${events.startsAt})`, sql`now()`)));
  return e ?? null;
}

export async function processInvites(db: Db, actor = "system"): Promise<RunResult> {
  const out: RunResult = { sent: 0, failed: 0, skipped: 0 };
  if (!emailConfigured()) return { ...out, note: "Email isn't set up here (RESEND_API_KEY)." };
  const address = await postalAddress(db);
  if (!address) return { ...out, note: "No postal address is set, so nothing was sent." };

  const queued = await db.select().from(inviteCampaigns).where(eq(inviteCampaigns.status, "queued")).orderBy(asc(inviteCampaigns.id));
  for (const c of queued) {
    const room = (await remainingToday(db)) - INVITE_RESERVE;
    if (room <= 0) { out.note = "Today's email limit is reached; the daily run continues tomorrow."; break; }
    const claimed = await db.execute<{ id: number; contact_id: number }>(sql`
      update invite_queue set status = 'sending'
      where id in (select id from invite_queue where campaign_id = ${c.id} and status = 'queued' order by id limit ${room} for update skip locked)
      returning id, contact_id`);
    const rows = claimed.rows.map((r) => ({ id: Number(r.id), contactId: Number(r.contact_id) }));
    if (rows.length) {
      // Re-checked at its turn: linked, suppressed or invited since it was queued → skipped.
      const ok = await db.select({ id: contacts.id, email: contacts.email, name: contacts.name, source: contacts.source }).from(contacts)
        .where(and(inArray(contacts.id, rows.map((r) => r.contactId)), eligibleWhere()));
      const okIds = new Set(ok.map((x) => x.id));
      const skip = rows.filter((r) => !okIds.has(r.contactId)).map((r) => r.id);
      if (skip.length) await db.update(inviteQueue).set({ status: "skipped" }).where(inArray(inviteQueue.id, skip));
      out.skipped += skip.length;

      const draft = InviteDraft.parse({ subject: c.subject, body: c.body, reason: c.reason });
      const event = await featured(db, c.eventId);
      const qid = new Map(rows.map((r) => [r.contactId, r.id]));
      for (let i = 0; i < ok.length; i += CHUNK) {
        const chunk = ok.slice(i, i + CHUNK);
        const r = await sendBatch(db, "invite", chunk.map((x) => inviteEmail(draft, { to: x.email!, source: c.source, contact: { id: x.id, name: x.name }, event, postalAddress: address })));
        const ids = chunk.map((x) => x.id), queueIds = ids.map((id) => qid.get(id)!);
        if (r.ok) {
          // invited_at is set once and never reset: this contact is never invited again.
          await db.batch([
            db.update(inviteQueue).set({ status: "sent", sentAt: new Date() }).where(inArray(inviteQueue.id, queueIds)),
            db.update(contacts).set({ invitedAt: new Date() }).where(and(inArray(contacts.id, ids), isNull(contacts.invitedAt))),
            db.insert(adminAudit).values(auditRow(actor, "invite.batch", `Campaign #${c.id}: ${chunk.length} invites sent`)),
          ]);
          out.sent += chunk.length;
        } else {
          await db.batch([
            db.update(inviteQueue).set({ status: "failed" }).where(inArray(inviteQueue.id, queueIds)),
            db.insert(adminAudit).values(auditRow(actor, "invite.batch", `Campaign #${c.id}: a batch of ${chunk.length} failed (${r.error})`)),
          ]);
          out.failed += chunk.length;
        }
      }
    }
    const [{ left }] = await db.select({ left: sql<number>`count(*)::int` }).from(inviteQueue)
      .where(and(eq(inviteQueue.campaignId, c.id), inArray(inviteQueue.status, ["queued", "sending"])));
    if (!left) await db.update(inviteCampaigns).set({ status: "done", updatedAt: new Date() }).where(and(eq(inviteCampaigns.id, c.id), eq(inviteCampaigns.status, "queued")));
  }
  return out;
}

/** Queue counts per campaign: queued, sending, sent, failed, skipped. */
export async function campaignProgress(db: Db, ids: number[]) {
  if (!ids.length) return new Map<number, Record<string, number>>();
  const rows = await db.select({ c: inviteQueue.campaignId, s: inviteQueue.status, n: sql<number>`count(*)::int` }).from(inviteQueue)
    .where(inArray(inviteQueue.campaignId, ids)).groupBy(inviteQueue.campaignId, inviteQueue.status);
  const m = new Map<number, Record<string, number>>();
  for (const r of rows) m.set(r.c, { ...(m.get(r.c) ?? {}), [r.s]: r.n });
  return m;
}
