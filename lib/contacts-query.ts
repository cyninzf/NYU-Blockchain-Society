import "server-only";
import { and, arrayContains, count, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "./db";
import { contacts, inviteQueue, inviteSuppressions, members } from "./db/schema";
import { eligibleWhere, hashSql, personalSql } from "./invites";
import { CONTACT_FOCUS, CONTACT_TYPES, INVESTOR_STAGES, RELATIONSHIPS, type ContactFocus, type ContactType, type InvestorStage, type Relationship } from "./contact-fields";

export const INVITE_STATUSES = ["eligible", "personal", "queued", "invited", "joined", "unsubscribed", "bounced", "none"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];
export const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  eligible: "Eligible", personal: "Personal (not auto-invited)", queued: "Queued", invited: "Invited", joined: "Joined", unsubscribed: "Unsubscribed", bounced: "Bounced / spam", none: "No email",
};

/**
 * One invite status per contact (round 12), in this order: joined (linked to a member) →
 * unsubscribed from an invite → bounced or complained → invited → queued in a campaign → personal
 * (eligible, but a "via-" introduction: never auto-invited, round 26) → eligible → no (valid) email.
 */
const suppressedAs = (reasons: string[]) =>
  sql`exists (select 1 from ${inviteSuppressions} s where s.email_hash = ${hashSql(contacts.email)} and s.reason in (${sql.join(reasons.map((r) => sql`${r}`), sql`, `)}))`;
export const inviteStatusSql = sql<InviteStatus>`case
  when ${contacts.memberId} is not null then 'joined'
  when ${contacts.email} is not null and ${suppressedAs(["unsubscribe"])} then 'unsubscribed'
  when ${contacts.email} is not null and ${suppressedAs(["bounce", "complaint"])} then 'bounced'
  when ${contacts.invitedAt} is not null then 'invited'
  when exists (select 1 from ${inviteQueue} q where q.contact_id = ${contacts.id} and q.status in ('queued', 'sending')) then 'queued'
  when ${eligibleWhere()} and ${personalSql} then 'personal'
  when ${eligibleWhere()} then 'eligible'
  else 'none' end`;

export type ContactFilters = {
  q?: string; source?: string; linked?: "yes" | "no"; checkedIn?: "yes" | "no" | "unknown"; invite?: InviteStatus;
  /** Investor network (round 28). `type=none`: contacts without a type. */
  type?: ContactType | "none"; focus?: ContactFocus; stage?: InvestorStage; relationship?: Relationship;
};

const pick = <T extends string>(v: unknown, allowed: readonly T[]) => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

export function parseContactFilters(sp: Record<string, string | string[] | undefined>): ContactFilters {
  return {
    q: typeof sp.q === "string" && sp.q.trim() ? sp.q.trim().slice(0, 80) : undefined,
    source: typeof sp.source === "string" && /^[a-z0-9-]{1,40}$/.test(sp.source) ? sp.source : undefined,
    linked: pick(sp.linked, ["yes", "no"] as const),
    checkedIn: pick(sp.checkedIn, ["yes", "no", "unknown"] as const),
    invite: pick(sp.invite, INVITE_STATUSES),
    type: pick(sp.type, [...CONTACT_TYPES, "none"] as const),
    focus: pick(sp.focus, CONTACT_FOCUS),
    stage: pick(sp.stage, INVESTOR_STAGES),
    relationship: pick(sp.relationship, RELATIONSHIPS),
  };
}

function contactWhere(f: ContactFilters): SQL | undefined {
  const where: SQL[] = [];
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(contacts.name, like), ilike(contacts.email, like), ilike(contacts.headline, like), ilike(contacts.company, like), ilike(contacts.notes, like), ilike(contacts.linkedinUrl, like))!);
  }
  if (f.source) where.push(eq(contacts.source, f.source));
  if (f.linked) where.push(f.linked === "yes" ? isNotNull(contacts.memberId) : isNull(contacts.memberId));
  if (f.checkedIn) where.push(f.checkedIn === "unknown" ? isNull(contacts.checkedIn) : eq(contacts.checkedIn, f.checkedIn === "yes"));
  if (f.invite) where.push(sql`(${inviteStatusSql}) = ${f.invite}`);
  if (f.type) where.push(f.type === "none" ? isNull(contacts.contactType) : eq(contacts.contactType, f.type));
  if (f.focus) where.push(arrayContains(contacts.focus, [f.focus]));
  if (f.stage) where.push(eq(contacts.stage, f.stage));
  if (f.relationship) where.push(eq(contacts.relationship, f.relationship));
  return where.length ? and(...where) : undefined;
}

/** Contacts (newest first) with the linked member's name, if any. Every match, or one page (`page`: limit and offset). */
export function listContacts(db: Db, f: ContactFilters, page?: { limit: number; offset: number }) {
  const q = db.select({ c: contacts, memberName: members.name, invite: inviteStatusSql }).from(contacts).leftJoin(members, eq(members.id, contacts.memberId))
    .where(contactWhere(f)).orderBy(desc(contacts.id)).$dynamic();
  return page ? q.limit(page.limit).offset(page.offset) : q;
}

/** How many contacts match, for the pager. */
export async function countContacts(db: Db, f: ContactFilters) {
  const [{ n }] = await db.select({ n: count() }).from(contacts).where(contactWhere(f));
  return n;
}

export async function listSources(db: Db) {
  const rows = await db.selectDistinct({ source: contacts.source }).from(contacts).orderBy(contacts.source);
  return rows.map((r) => r.source);
}

/** Header numbers for /admin. Contacts are never counted as members; "converted" is every linked contact, however it was linked. */
export async function adminCounts(db: Db) {
  const [[m], [c]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(members),
    db.select({
      n: sql<number>`count(*)::int`,
      converted: sql<number>`count(${contacts.memberId})::int`,
      known: sql<number>`count(${contacts.checkedIn})::int`,
      checkedIn: sql<number>`count(*) filter (where ${contacts.checkedIn})::int`,
    }).from(contacts),
  ]);
  return { members: m.n, contacts: c.n, converted: c.converted, checkedIn: c.known ? c.checkedIn : null };
}

/**
 * "Investor network" on /admin (round 28): contacts with a type, counted by type and relationship.
 * Counts only, for organizers.
 */
export async function investorNetwork(db: Db) {
  const rows = await db.select({ type: contacts.contactType, relationship: contacts.relationship, n: sql<number>`count(*)::int` })
    .from(contacts).where(isNotNull(contacts.contactType)).groupBy(contacts.contactType, contacts.relationship);
  return rows as { type: ContactType; relationship: Relationship; n: number }[];
}
