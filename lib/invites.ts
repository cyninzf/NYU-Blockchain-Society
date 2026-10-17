import "server-only";
import { createHash } from "node:crypto";
import { and, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import type { Db } from "./db";
import { FORM_SOURCES, isProtectedSource, PERSONAL_PREFIX } from "./contacts-import";
import { contacts, inviteQueue, inviteSuppressions, type SuppressionReason } from "./db/schema";

// One-time invites to contacts (round 12). The rules, enforced here and nowhere else:
// - eligible: a valid email, not linked to a member, never invited (contacts.invited_at is set
//   once, on send, and never reset) and not on the suppression list;
// - suppressed: anyone who unsubscribed from an invite, bounced or complained. The list holds a
//   hash of the address, so a contact re-imported later is still recognised.
// - personal introductions (round 26): contacts whose source starts "via-" are eligible but never
//   queued unless a super admin picked that exact source, ticked it and confirmed the warning
//   (`invite_campaigns.include_personal`); the queue re-checks this at send time too.
// - form submissions (round 28.1): sources accelerator-form and investor-list follow the same rule
//   (`formSql`); together with via- they're the "protected" sources (`protectedSql`).

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
/** A form submission: source accelerator-form or investor-list (`FORM_SOURCES`). */
export const formSql = sql`${contacts.source} in (${sql.join(FORM_SOURCES.map((f) => sql`${f}`), sql`, `)})`;
/** Never in a bulk invite without the explicit choice of that source. */
export const protectedSql = sql`(${personalSql} or ${formSql})`;

/**
 * Protected sources (personal introductions and form submissions) only when a campaign explicitly
 * includes that source: `chosen` is the source chosen and confirmed for it, or null. Anything else
 * leaves every protected contact out.
 */
export const protectedAllowed = (chosen: string | null): SQL =>
  chosen && isProtectedSource(chosen) ? sql`(not ${protectedSql} or ${contacts.source} = ${chosen})` : sql`not ${protectedSql}`;

/**
 * Eligible and not already queued in a campaign: who a new campaign would add. Protected sources
 * are left out unless `chosen` names their source (explicitly chosen and confirmed).
 */
export const queueableWhere = (chosen: string | null = null): SQL =>
  and(eligibleWhere(), protectedAllowed(chosen), notQueuedSql)!;

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
