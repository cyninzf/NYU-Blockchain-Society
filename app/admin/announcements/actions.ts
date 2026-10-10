"use server";

import { and, count, eq, gt, inArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { auditRow, describeFilters, requireAdmin } from "@/lib/admin";
import { announcementEmail, Content, contentHash, Filters, recipients, recipientWhere } from "@/lib/announcements";
import { isProduction } from "@/lib/base-url";
import { adminAudit, announcements, members, type AnnouncementFilters } from "@/lib/db/schema";
import { DAILY_EMAIL_LIMIT, remainingToday, sendBatch, sendEmail } from "@/lib/email";
import { postalAddress } from "@/lib/settings";

// Both roles may draft, test and send. Every test and send is logged (announcements and
// admin_audit) with the admin's email.

export type Draft = { subject: string; body: string; filters: AnnouncementFilters };
export type CountResult = { ok: true; recipients: number; remaining: number; limit: number } | { ok: false; error: string };
export type SendResult = { ok: true; message: string } | { ok: false; error: string };

const parseFilters = (f: unknown) => {
  const p = Filters.safeParse(f);
  if (!p.success) return null;
  const { blocks, notify, affiliation, country } = p.data;
  // Only what's set, so the log reads cleanly.
  return { ...(blocks?.length ? { blocks } : {}), ...(notify?.length ? { notify } : {}), ...(affiliation ? { affiliation } : {}), ...(country ? { country } : {}) } as AnnouncementFilters;
};

export async function countRecipients(f: AnnouncementFilters): Promise<CountResult> {
  const { db } = await requireAdmin();
  const filters = parseFilters(f);
  if (!filters) return { ok: false, error: "Check the filters." };
  const [[{ n }], remaining] = await Promise.all([
    db.select({ n: count() }).from(members).where(recipientWhere(filters)),
    remainingToday(db),
  ]);
  return { ok: true, recipients: n, remaining, limit: DAILY_EMAIL_LIMIT };
}

/** Sends the draft to the signed-in admin's own email, marked as a test. */
export async function sendTest(d: Draft): Promise<SendResult> {
  const { db, admin, actor } = await requireAdmin();
  const c = Content.safeParse(d);
  const filters = parseFilters(d.filters);
  if (!c.success) return { ok: false, error: c.error.issues[0]?.message ?? "Check the announcement." };
  if (!filters) return { ok: false, error: "Check the filters." };
  const r = await sendEmail(db, "announcement-test", announcementEmail(c.data, admin.email, null, await postalAddress(db)));
  if (!r.ok) return { ok: false, error: r.error };
  const hash = contentHash(c.data);
  await db.batch([
    db.insert(announcements).values({ status: "test", ...c.data, contentHash: hash, filters, recipientCount: 1, sentCount: 1, sentBy: actor }),
    db.insert(adminAudit).values(auditRow(actor, "announcement.test", `Test of "${c.data.subject}" sent to ${admin.email}`)),
  ]);
  refresh();
  return { ok: true, message: `Test sent to ${admin.email}. Check it, then send.` };
}

/**
 * The real send. Refused unless: in production (previews hold copies of real
 * members), the same text was test-sent in the last 24 hours, it wasn't already sent today, and
 * the recipients fit in what's left of the daily email limit.
 */
export async function sendAnnouncement(d: Draft, expected: number): Promise<SendResult> {
  const { db, actor } = await requireAdmin();
  if (!isProduction()) return { ok: false, error: "Announcements only go out from the production site. Test sends work here." };
  const c = Content.safeParse(d);
  const filters = parseFilters(d.filters);
  if (!c.success) return { ok: false, error: c.error.issues[0]?.message ?? "Check the announcement." };
  if (!filters) return { ok: false, error: "Check the filters." };
  const hash = contentHash(c.data);
  const since = sql`now() - interval '24 hours'`;
  const prior = await db.select({ status: announcements.status }).from(announcements)
    .where(and(eq(announcements.contentHash, hash), gt(announcements.createdAt, since), inArray(announcements.status, ["test", "sent", "partial"])));
  if (prior.some((p) => p.status !== "test")) return { ok: false, error: "This announcement was already sent in the last 24 hours." };
  if (!prior.length) return { ok: false, error: "Send yourself a test of this exact text first (any edit needs a new test)." };

  const list = await recipients(db, filters);
  if (!list.length) return { ok: false, error: "No members match these filters." };
  if (list.length !== expected) return { ok: false, error: `The recipient count changed to ${list.length}. Check it and send again.` };
  const remaining = await remainingToday(db);
  if (list.length > remaining) {
    return { ok: false, error: `This would send ${list.length} emails, but only ${remaining} of today's ${DAILY_EMAIL_LIMIT} are left. Narrow the filters or send later.` };
  }

  const address = await postalAddress(db);
  const r = await sendBatch(db, "announcement", list.map((m) => announcementEmail(c.data, m.email, m.id, address)));
  const status = r.ok ? "sent" : r.sent ? "partial" : "failed";
  await db.batch([
    db.insert(announcements).values({ status, ...c.data, contentHash: hash, filters, recipientCount: list.length, sentCount: r.sent, sentBy: actor }),
    db.insert(adminAudit).values(auditRow(actor, "announcement.send", `"${c.data.subject}": ${r.sent} of ${list.length} sent (${status}; filters: ${describeFilters(filters)})`)),
  ]);
  refresh();
  return r.ok ? { ok: true, message: `Sent to ${r.sent} members.` } : { ok: false, error: `${r.error} Logged as ${status}.` };
}
