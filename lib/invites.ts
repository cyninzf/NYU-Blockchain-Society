import "server-only";
import { createHash } from "node:crypto";
import { and, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import type { Db } from "./db";
import { isPersonalSource, PERSONAL_PREFIX } from "./contacts-import";
import { contacts, inviteQueue, inviteSuppressions, type SuppressionReason } from "./db/schema";

// One-time invites to contacts (round 12). The rules, enforced here and nowhere else:
// - eligible: a valid email, not linked to a member, never invited (contacts.invited_at is set
//   once, on send, and never reset) and not on the suppression list;
// - suppressed: anyone who unsubscribed from an invite, bounced or complained. The list holds a
//   hash of the address, so a contact re-imported later is still recognised.
// - personal introductions (round 26): contacts whose source starts "via-" are eligible but never
//   queued unless a super admin picked that exact source, ticked it and confirmed the warning
//   (`invite_campaigns.include_personal`); the queue re-checks this at send time too.

/**
 * The suppression key: SHA-256 of a fixed prefix and the lowercased, trimmed address, hex. No
 * secret on purpose: rotating a secret must never forget who asked not to be emailed. The same
 * expression in SQL (`hashSql`) lets eligibility be checked in the database.
 */
export const emailHash = (email: string) => createHash("sha256").update(`nyubs-suppress:${email.trim().toLowerCase()}`).digest("hex");
export const hashSql = (col: SQL | typeof contacts.email) => sql`encode(sha256(convert_to('nyubs-suppress:' || lower(trim(${col})), 'UTF8')), 'hex')`;

/** A plausible address (the import already validated it; this guards older rows). */
const VALID = sql`${contacts.email} ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'`;

export const suppressedSql = sql`exists (select 1 from ${inviteSuppressions} s where s.email_hash = ${hashSql(contacts.email)})`;

/** Contacts that may be invited, now. */
export const eligibleWhere = (): SQL => and(isNotNull(contacts.email), VALID, isNull(contacts.memberId), isNull(contacts.invitedAt), sql`not ${suppressedSql}`)!;

/** Not in any campaign's queue yet (the queue is unique on contact). */
export const notQueuedSql = sql`not exists (select 1 from ${inviteQueue} q where q.contact_id = ${contacts.id})`;

/** A personal introduction: source "via-…" (`PERSONAL_PREFIX`). */
export const personalSql = sql`${contacts.source} like ${PERSONAL_PREFIX + "%"}`;

/**
 * Personal introductions only when a campaign explicitly includes that source: `personal` is the
 * source chosen and confirmed for it, or null. Anything else leaves every via- contact out.
 */
export const personalAllowed = (personal: string | null): SQL =>
  personal && isPersonalSource(personal) ? sql`(not ${personalSql} or ${contacts.source} = ${personal})` : sql`not ${personalSql}`;

/**
 * Eligible and not already queued in a campaign: who a new campaign would add. Personal
 * introductions are left out unless `personal` names their source (explicitly chosen and confirmed).
 */
export const queueableWhere = (personal: string | null = null): SQL =>
  and(eligibleWhere(), personalAllowed(personal), notQueuedSql)!;

/** Adds an address to the suppression list (the first reason is kept). */
export async function suppress(db: Db, email: string, reason: SuppressionReason) {
  await db.insert(inviteSuppressions).values({ emailHash: emailHash(email), reason }).onConflictDoNothing();
}

/**
 * Of these addresses, the ones that hard-bounced or complained: no email of any kind goes to them
 * (an invite unsubscribe only stops invites; joining later is their own choice).
 */
export async function undeliverable(db: Db, emails: string[]): Promise<Set<string>> {
  if (!emails.length) return new Set();
  const byHash = new Map(emails.map((e) => [emailHash(e), e.trim().toLowerCase()]));
  const rows = await db.select({ h: inviteSuppressions.emailHash }).from(inviteSuppressions)
    .where(and(inArray(inviteSuppressions.emailHash, [...byHash.keys()]), inArray(inviteSuppressions.reason, ["bounce", "complaint"])));
  return new Set(rows.map((r) => byHash.get(r.h)!));
}
