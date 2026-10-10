import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { auditRow } from "./admin";
import { baseUrl } from "./base-url";
import type { Db } from "./db";
import { adminAudit, eventCheckins, events, members, type EventRow } from "./db/schema";
import { renderEmail, sendEmail } from "./email";
import { eventWhen } from "./event-time";
import { createLinkToken } from "./magic-link";
import { unsubscribeHeaders, unsubscribeUrl } from "./member-email";

// Event check-in (round 11). Open for published events from 3 hours before the start until
// 2 hours after the end (or the start, without an end). Every check-in is logged.

export const OPENS_BEFORE_H = 3;
export const CLOSES_AFTER_H = 2;

export type CheckinEvent = Pick<EventRow, "id" | "title" | "kind" | "slug" | "startsAt" | "endsAt" | "venueName" | "address" | "description" | "registrationUrl" | "cohost"> & {
  /** "before" | "open" | "after", by the database clock. */
  window: "before" | "open" | "after";
};

/** A published event by slug with its check-in window, or null (drafts and cancelled events never). */
export async function checkinEvent(db: Db, slug: string): Promise<CheckinEvent | null> {
  const [e] = await db.select({
    id: events.id, title: events.title, kind: events.kind, slug: events.slug, startsAt: events.startsAt, endsAt: events.endsAt,
    venueName: events.venueName, address: events.address, description: events.description, registrationUrl: events.registrationUrl, cohost: events.cohost,
    window: sql<CheckinEvent["window"]>`case
      when now() < ${events.startsAt} - ${sql.raw(`interval '${OPENS_BEFORE_H} hours'`)} then 'before'
      when now() > coalesce(${events.endsAt}, ${events.startsAt}) + ${sql.raw(`interval '${CLOSES_AFTER_H} hours'`)} then 'after'
      else 'open' end`,
  }).from(events).where(and(eq(events.slug, slug), eq(events.status, "published")));
  return e ?? null;
}

/**
 * Records a check-in (once per member per event) and logs it: actor "system" for a member
 * checking themselves in, the admin's email for a manual one. True when it's new.
 */
export async function recordCheckin(db: Db, eventId: number, memberId: number, method: "qr" | "admin", actor = "system"): Promise<boolean> {
  const [row] = await db.insert(eventCheckins).values({ eventId, memberId, method }).onConflictDoNothing().returning({ id: eventCheckins.id });
  if (row) await db.insert(adminAudit).values(auditRow(actor, "event.checkin", `Checked in member #${memberId} at event #${eventId} (${method})`, { memberId }));
  return Boolean(row);
}

export async function isCheckedIn(db: Db, eventId: number, memberId: number) {
  const [r] = await db.select({ id: eventCheckins.id }).from(eventCheckins).where(and(eq(eventCheckins.eventId, eventId), eq(eventCheckins.memberId, memberId)));
  return Boolean(r);
}

/**
 * Emails a member a one-tap check-in link (single use, 15 minutes, like "Update your block").
 * Does nothing for an unknown or unsubscribed email, so callers answer the same either way.
 */
export async function sendCheckinLink(db: Db, email: string, e: Pick<EventRow, "id" | "slug" | "title" | "startsAt" | "endsAt">) {
  const [m] = await db.select({ id: members.id, email: members.email }).from(members)
    .where(and(eq(sql`lower(${members.email})`, email.toLowerCase()), isNull(members.unsubscribedAt)));
  if (!m || (await isCheckedIn(db, e.id, m.id))) return;
  const token = await createLinkToken(db, "checkin", `${m.id}:${e.id}`);
  const r = await sendEmail(db, "checkin-link", {
    to: m.email,
    subject: `Check in: ${e.title}`,
    ...renderEmail({
      kicker: "Check-in",
      heading: e.title,
      paragraphs: [eventWhen(e.startsAt, e.endsAt), "Tap the button to check in. It works once and expires in 15 minutes."],
      cta: { label: "Check in", href: `${baseUrl()}/events/${e.slug}/checkin/confirm?t=${token}` },
      note: "If you didn't ask for this, ignore this email: nothing happens without the button.",
      unsubscribeUrl: unsubscribeUrl(m.id),
    }),
    headers: unsubscribeHeaders(m.id),
  });
  if (!r.ok) console.error("check-in link not sent:", r.error);
}
