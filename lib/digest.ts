import "server-only";
import { and, desc, eq, gt, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { TOPIC_LABELS } from "@/content/contact";
import { auditRow, superAdminEmail } from "./admin";
import { baseUrl } from "./base-url";
import type { Db } from "./db";
import { acceleratorInterest, adminAudit, adminUsers, conferenceInquiries, contactMessages, members, pendingJoins } from "./db/schema";
import { remainingToday, renderEmail, sendBatch, type Message } from "./email";
import { INTEREST_LABELS } from "./inquiries";
import { AFFILIATION_LABELS } from "./members-query";
import { getSetting } from "./settings";

// The daily admin digest (round 22). Organizers get no email per join; instead, once a day (the
// morning cron run), one email to the super admin and the "Digest recipients" in Settings,
// sent only when something waits for review or something is new. Quiet days send nothing.
// Names, affiliations and sources only: never an email address or a message's content.

const DAY = 24 * 60 * 60 * 1000;
/** A second cron call the same day (Vercel can retry) never sends a second digest. */
const MIN_GAP = 20 * 60 * 60 * 1000;
/** Each list stops here, with "and n more". */
const MAX_ITEMS = 40;

export type Digest = {
  since: Date;
  waiting: string[];
  privacy: string[];
  newMembers: string[];
  newMessages: string[];
};

/** "3 days", "5 hours", "under an hour" */
export function waited(from: Date, now: Date) {
  const h = Math.floor((now.getTime() - from.getTime()) / 3_600_000);
  if (h < 1) return "under an hour";
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"}`;
  return `${Math.floor(h / 24)} days`;
}

const clip = (items: string[]) => (items.length > MAX_ITEMS ? [...items.slice(0, MAX_ITEMS), `and ${items.length - MAX_ITEMS} more`] : items);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 80);
/** "2 Sponsor, 1 Speak" */
const tally = (values: string[]) => [...values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>())].map(([v, n]) => `${n} ${v}`).join(", ");

/** When the last real digest went out (admin_audit), if ever. */
async function lastSent(db: Db): Promise<Date | null> {
  const [r] = await db.select({ at: adminAudit.createdAt }).from(adminAudit).where(eq(adminAudit.action, "digest.send")).orderBy(desc(adminAudit.createdAt)).limit(1);
  return r?.at ?? null;
}

/** What the digest would say now. "New" means since the last digest (at most 7 days back), else the last 24 hours. */
export async function buildDigest(db: Db, now = new Date()): Promise<Digest> {
  const last = await lastSent(db);
  const since = new Date(Math.max(last?.getTime() ?? now.getTime() - DAY, now.getTime() - 7 * DAY));
  const [pending, spamInq, spamAcc, spamContact, privacy, newMembers, inq, acc, contact] = await Promise.all([
    db.select().from(pendingJoins).orderBy(pendingJoins.createdAt),
    db.select().from(conferenceInquiries).where(eq(conferenceInquiries.suspectedSpam, true)).orderBy(conferenceInquiries.createdAt),
    db.select().from(acceleratorInterest).where(eq(acceleratorInterest.suspectedSpam, true)).orderBy(acceleratorInterest.createdAt),
    db.select().from(contactMessages).where(eq(contactMessages.suspectedSpam, true)).orderBy(contactMessages.createdAt),
    db.select().from(contactMessages).where(and(
      inArray(contactMessages.topic, ["privacy_access", "privacy_delete"]), isNotNull(contactMessages.verifiedAt),
      ne(contactMessages.status, "closed"), eq(contactMessages.suspectedSpam, false),
    )).orderBy(contactMessages.verifiedAt),
    db.select({ id: members.id, name: members.name, affiliation: members.affiliation, source: members.source }).from(members).where(gt(members.createdAt, since)).orderBy(members.id),
    db.select({ interest: conferenceInquiries.interest }).from(conferenceInquiries).where(and(gt(conferenceInquiries.createdAt, since), eq(conferenceInquiries.suspectedSpam, false))),
    db.select({ type: acceleratorInterest.type }).from(acceleratorInterest).where(and(gt(acceleratorInterest.createdAt, since), eq(acceleratorInterest.suspectedSpam, false))),
    db.select({ topic: contactMessages.topic }).from(contactMessages).where(and(gt(contactMessages.createdAt, since), eq(contactMessages.suspectedSpam, false))),
  ]);

  const w = (at: Date) => `waiting ${waited(at, now)}`;
  const waiting = [
    ...pending.map((p) => ({ at: p.createdAt, t: `${p.kind === "checkin" ? "Check-in join" : "Join"}: ${oneLine(p.name)} (${AFFILIATION_LABELS[p.affiliation]})` })),
    ...spamInq.map((r) => ({ at: r.createdAt, t: `Conference inquiry (${INTEREST_LABELS[r.interest]}): ${oneLine(r.name)}` })),
    ...spamAcc.map((r) => ({ at: r.createdAt, t: `Accelerator ${r.type}: ${oneLine(r.name)}` })),
    ...spamContact.map((r) => ({ at: r.createdAt, t: `Contact message (${TOPIC_LABELS[r.topic]}): ${oneLine(r.name)}` })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime()).map((x) => `${x.t} · ${w(x.at)}`);

  return {
    since,
    waiting,
    privacy: privacy.map((r) => `${r.topic === "privacy_delete" ? "Delete my data" : "Access my data"}: ${oneLine(r.name)} · verified ${waited(r.verifiedAt!, now)} ago · ${r.status}`),
    newMembers: newMembers.map((m) => `${oneLine(m.name)} · ${AFFILIATION_LABELS[m.affiliation]} · source ${m.source ?? "none"}`),
    newMessages: [
      ...(inq.length ? [`Conference inquiries: ${tally(inq.map((r) => INTEREST_LABELS[r.interest]))}`] : []),
      ...(acc.length ? [`Accelerator: ${tally(acc.map((r) => (r.type === "founder" ? "founder" : "supporter")))}`] : []),
      ...(contact.length ? [`Contact messages: ${tally(contact.map((r) => TOPIC_LABELS[r.topic]))}`] : []),
    ],
  };
}

export const digestIsQuiet = (d: Digest) => !d.waiting.length && !d.privacy.length && !d.newMembers.length && !d.newMessages.length;

const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" });

export function digestEmail(d: Digest, to: string, test: boolean, now = new Date()): Message {
  const parts = [
    d.waiting.length && `${d.waiting.length} waiting for review`,
    d.privacy.length && `${d.privacy.length} privacy request${d.privacy.length === 1 ? "" : "s"}`,
    d.newMembers.length && `${d.newMembers.length} new member${d.newMembers.length === 1 ? "" : "s"}`,
  ].filter(Boolean);
  const heading = parts.length ? parts.join(" · ") : d.newMessages.length ? "New messages" : "Nothing new";
  const sections = [
    ...(d.waiting.length ? [{ title: `Waiting for review (${d.waiting.length})`, items: clip(d.waiting) }] : []),
    ...(d.privacy.length ? [{ title: `Privacy requests, verified and not closed (${d.privacy.length})`, items: clip(d.privacy) }] : []),
    ...(d.newMembers.length ? [{ title: `New members (${d.newMembers.length})`, items: clip(d.newMembers) }] : []),
    ...(d.newMessages.length ? [{ title: "New inquiries and messages", items: d.newMessages }] : []),
  ];
  return {
    to,
    subject: `${test ? "[Test] " : ""}Daily digest: ${heading}`,
    ...renderEmail({
      kicker: `${test ? "Test · " : ""}Daily digest · ${dayFmt.format(now)}`,
      heading,
      paragraphs: [
        ...(digestIsQuiet(d) ? ["Nothing is waiting and nothing is new. On a day like this the real digest isn't sent."] : []),
        ...(d.waiting.length ? ["Suspected spam is held until a super admin marks it Not spam or deletes it."] : []),
      ],
      sections,
      cta: { label: "Open admin", href: `${baseUrl()}/admin` },
      note: "Sent to organizers once a day when something is waiting or new. Recipients are set in Admin › Settings.",
    }),
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "a@x.com, b@y.com\nc@z.com" → lowercase addresses, deduped. */
export const parseRecipients = (v: string | null) => [...new Set((v ?? "").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
export const invalidRecipient = (list: string[]) => list.find((e) => !EMAIL_RE.test(e) || e.length > 254);

/** Active organizers (admin_users not removed) among these addresses. */
export async function activeAdmins(db: Db, list: string[]): Promise<Set<string>> {
  if (!list.length) return new Set();
  const rows = await db.select({ email: adminUsers.email }).from(adminUsers).where(and(isNull(adminUsers.removedAt), inArray(sql`lower(${adminUsers.email})`, list)));
  return new Set(rows.map((r) => r.email.toLowerCase()));
}

/** The super admin plus the "Digest recipients" setting, kept only while they're active organizers (the digest holds names). */
export async function digestRecipients(db: Db): Promise<string[]> {
  const listed = parseRecipients(await getSetting(db, "digest_recipients"));
  const admins = await activeAdmins(db, listed);
  const sup = superAdminEmail();
  return [...new Set([...(sup ? [sup] : []), ...listed.filter((e) => admins.has(e))])];
}

export type DigestRun = { sent: number; skipped: number; note?: string };

/**
 * The morning cron run: skipped on quiet days and when one already went out in the last 20 hours;
 * otherwise one email per recipient (bounced or spam-reporting addresses are skipped by
 * sendBatch), logged as digest.send with the recipient count only. `send` is replaceable for tests.
 */
export async function runDigest(db: Db, now = new Date(), send = sendBatch): Promise<DigestRun> {
  const last = await lastSent(db);
  if (last && now.getTime() - last.getTime() < MIN_GAP) return { sent: 0, skipped: 0, note: "already sent today" };
  const d = await buildDigest(db, now);
  if (digestIsQuiet(d)) return { sent: 0, skipped: 0, note: "quiet day" };
  const to = await digestRecipients(db);
  if (!to.length) return { sent: 0, skipped: 0, note: "no recipients" };
  if ((await remainingToday(db)) < to.length) return { sent: 0, skipped: 0, note: "daily email limit reached" };
  const r = await send(db, "digest", to.map((t) => digestEmail(d, t, false, now)));
  if (r.sent) await db.insert(adminAudit).values(auditRow("system", "digest.send", `Daily digest sent to ${r.sent} recipient${r.sent === 1 ? "" : "s"}${r.skipped ? ` (${r.skipped} skipped: bounced or spam)` : ""}`));
  return { sent: r.sent, skipped: r.skipped, ...(r.ok ? {} : { note: r.error }) };
}
