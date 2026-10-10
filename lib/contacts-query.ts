import "server-only";
import { and, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "./db";
import { contacts, inviteQueue, inviteSuppressions, members } from "./db/schema";
import { eligibleWhere, hashSql } from "./invites";

export const INVITE_STATUSES = ["eligible", "queued", "invited", "joined", "unsubscribed", "bounced", "none"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];
export const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  eligible: "Eligible", queued: "Queued", invited: "Invited", joined: "Joined", unsubscribed: "Unsubscribed", bounced: "Bounced / spam", none: "No email",
};

/**
 * One invite status per contact (round 12), in this order: joined (linked to a member) →
 * unsubscribed from an invite → bounced or complained → invited → queued in a campaign → eligible
 * → no (valid) email.
 */
const suppressedAs = (reasons: string[]) =>
  sql`exists (select 1 from ${inviteSuppressions} s where s.email_hash = ${hashSql(contacts.email)} and s.reason in (${sql.join(reasons.map((r) => sql`${r}`), sql`, `)}))`;
export const inviteStatusSql = sql<InviteStatus>`case
  when ${contacts.memberId} is not null then 'joined'
  when ${contacts.email} is not null and ${suppressedAs(["unsubscribe"])} then 'unsubscribed'
  when ${contacts.email} is not null and ${suppressedAs(["bounce", "complaint"])} then 'bounced'
  when ${contacts.invitedAt} is not null then 'invited'
  when exists (select 1 from ${inviteQueue} q where q.contact_id = ${contacts.id} and q.status in ('queued', 'sending')) then 'queued'
  when ${eligibleWhere()} then 'eligible'
  else 'none' end`;

export type ContactFilters = { q?: string; source?: string; linked?: "yes" | "no"; checkedIn?: "yes" | "no" | "unknown"; invite?: InviteStatus };

const pick = <T extends string>(v: unknown, allowed: readonly T[]) => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

export function parseContactFilters(sp: Record<string, string | string[] | undefined>): ContactFilters {
  return {
    q: typeof sp.q === "string" && sp.q.trim() ? sp.q.trim().slice(0, 80) : undefined,
    source: typeof sp.source === "string" && /^[a-z0-9-]{1,40}$/.test(sp.source) ? sp.source : undefined,
    linked: pick(sp.linked, ["yes", "no"] as const),
    checkedIn: pick(sp.checkedIn, ["yes", "no", "unknown"] as const),
    invite: pick(sp.invite, INVITE_STATUSES),
  };
}

/** Contacts (newest first) with the linked member's name, if any. */
export function listContacts(db: Db, f: ContactFilters) {
  const where: SQL[] = [];
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(contacts.name, like), ilike(contacts.email, like), ilike(contacts.headline, like))!);
  }
  if (f.source) where.push(eq(contacts.source, f.source));
  if (f.linked) where.push(f.linked === "yes" ? isNotNull(contacts.memberId) : isNull(contacts.memberId));
  if (f.checkedIn) where.push(f.checkedIn === "unknown" ? isNull(contacts.checkedIn) : eq(contacts.checkedIn, f.checkedIn === "yes"));
  if (f.invite) where.push(sql`(${inviteStatusSql}) = ${f.invite}`);
  return db.select({ c: contacts, memberName: members.name, invite: inviteStatusSql }).from(contacts).leftJoin(members, eq(members.id, contacts.memberId))
    .where(where.length ? and(...where) : undefined).orderBy(desc(contacts.id));
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
