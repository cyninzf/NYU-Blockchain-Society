import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "./db";
import { adminAudit, contactLinkBlocks, contacts, members } from "./db/schema";
import { auditRow } from "./admin";

// Automatic contact linking, so admins don't link by hand. Runs after every join, every admin
// member edit and every contacts import:
// - by email: a contact whose email matches a member's (any case) is linked ("auto (email)");
// - by name: a contact without an email is linked when its normalized name matches exactly one
//   member and no other contact without an email has that name ("auto (name)"). Anything less
//   clear is left for an admin under "Needs a look" on /admin/contacts.
// A pair an admin unlinked (contact_link_blocks) is never linked automatically again. Every
// automatic link is logged in admin_audit with actor "system".

export const LINK_LABELS: Record<string, string> = { email: "auto (email)", name: "auto (name)", invite: "auto (invite)", manual: "manual" };

/** Lowercased, trimmed, whitespace collapsed, accents stripped: "  José   García " → "jose garcia". */
export const nameKey = (name: string) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

type Link = { contactId: number; memberId: number };
export type Review = { contact: { id: number; name: string; headline: string | null; source: string }; candidates: { id: number; name: string }[] };

/** Name matches for contacts without an email: the clear ones to link, the unclear ones for an admin. */
export async function nameMatches(db: Db): Promise<{ link: Link[]; review: Review[] }> {
  const [people, emailless, blocks] = await Promise.all([
    db.select({ id: members.id, name: members.name }).from(members),
    db.select({ id: contacts.id, name: contacts.name, headline: contacts.headline, source: contacts.source, memberId: contacts.memberId })
      .from(contacts).where(and(isNull(contacts.email), sql`${contacts.name} is not null`)),
    db.select({ c: contactLinkBlocks.contactId, m: contactLinkBlocks.memberId }).from(contactLinkBlocks),
  ]);
  const group = <T,>(rows: T[], key: (r: T) => string) => {
    const g = new Map<string, T[]>();
    for (const r of rows) { const k = key(r); if (k) g.set(k, [...(g.get(k) ?? []), r]); }
    return g;
  };
  const byName = group(people, (m) => nameKey(m.name));
  const sameName = group(emailless, (c) => nameKey(c.name!));
  const blocked = new Set(blocks.map((b) => `${b.c}:${b.m}`));

  const link: Link[] = [], review: Review[] = [];
  for (const c of emailless) {
    if (c.memberId) continue;
    const k = nameKey(c.name!);
    const candidates = (byName.get(k) ?? []).filter((m) => !blocked.has(`${c.id}:${m.id}`));
    if (!candidates.length) continue;
    if (candidates.length === 1 && sameName.get(k)!.length === 1) link.push({ contactId: c.id, memberId: candidates[0].id });
    else review.push({ contact: { id: c.id, name: c.name!, headline: c.headline, source: c.source }, candidates: candidates.sort((a, b) => a.id - b.id) });
  }
  return { link, review };
}

/** Links every clear match (email first, then name) and logs each one. Returns how many of each. */
export async function autoLinkContacts(db: Db): Promise<{ email: Link[]; name: Link[] }> {
  const res = await db.execute<{ contact_id: number; member_id: number }>(sql`
    update contacts c set member_id = m.id, link_method = 'email'
    from members m
    where c.member_id is null and c.email is not null and lower(c.email) = lower(m.email)
      and not exists (select 1 from contact_link_blocks b where b.contact_id = c.id and b.member_id = m.id)
    returning c.id as contact_id, m.id as member_id`);
  const email = res.rows.map((r) => ({ contactId: Number(r.contact_id), memberId: Number(r.member_id) }));

  const name: Link[] = [];
  const { link } = await nameMatches(db);
  for (let i = 0; i < link.length; i += 100) {
    const chunk = link.slice(i, i + 100);
    // Still unlinked and still without an email: a concurrent run or an admin may have got there first.
    const queries = chunk.map((l) => db.update(contacts).set({ memberId: l.memberId, linkMethod: "name" })
      .where(and(eq(contacts.id, l.contactId), isNull(contacts.memberId), isNull(contacts.email))).returning({ id: contacts.id }));
    const done = await db.batch(queries as [(typeof queries)[number], ...typeof queries]);
    done.forEach((rows, j) => { if (rows.length) name.push(chunk[j]); });
  }

  const logs = [...email.map((l) => ({ ...l, how: "email" })), ...name.map((l) => ({ ...l, how: "name" }))]
    .map((l) => auditRow("system", "contact.autolink", `Linked contact #${l.contactId} to member #${l.memberId} (auto, ${l.how})`, { memberId: l.memberId }));
  for (let i = 0; i < logs.length; i += 500) await db.insert(adminAudit).values(logs.slice(i, i + 500));
  return { email, name };
}

/** For after(): linking never breaks or slows what triggered it. */
export const autoLinkQuietly = (db: Db) => autoLinkContacts(db).catch((e) => { console.error("contact auto-link failed", e instanceof Error ? e.message : e); });
