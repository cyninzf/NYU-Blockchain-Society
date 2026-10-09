import "server-only";
import { and, desc, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import type { Db } from "./db";
import { contacts, members } from "./db/schema";

export type ContactFilters = { source?: string; status?: "converted" | "open"; checkedIn?: "yes" | "no" | "unknown" };

const pick = <T extends string>(v: unknown, allowed: readonly T[]) => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

export function parseContactFilters(sp: Record<string, string | string[] | undefined>): ContactFilters {
  return {
    source: typeof sp.source === "string" && /^[a-z0-9-]{1,40}$/.test(sp.source) ? sp.source : undefined,
    status: pick(sp.status, ["converted", "open"] as const),
    checkedIn: pick(sp.checkedIn, ["yes", "no", "unknown"] as const),
  };
}

export function listContacts(db: Db, f: ContactFilters) {
  const where: SQL[] = [];
  if (f.source) where.push(eq(contacts.source, f.source));
  if (f.status) where.push(f.status === "converted" ? isNotNull(contacts.memberId) : isNull(contacts.memberId));
  if (f.checkedIn) where.push(f.checkedIn === "unknown" ? isNull(contacts.checkedIn) : eq(contacts.checkedIn, f.checkedIn === "yes"));
  return db.select().from(contacts).where(where.length ? and(...where) : undefined).orderBy(desc(contacts.id));
}

export async function listSources(db: Db) {
  const rows = await db.selectDistinct({ source: contacts.source }).from(contacts).orderBy(contacts.source);
  return rows.map((r) => r.source);
}

/** Header numbers for /admin. Contacts are never counted as members. */
export async function adminCounts(db: Db) {
  const [[m], [c]] = await Promise.all([
    // `src`: members who joined from a link with ?src=linkedin-group (or a dated variant)
    db.select({ n: sql<number>`count(*)::int`, linkedin: sql<number>`count(*) filter (where ${members.source} like 'linkedin-group%')::int` }).from(members),
    db.select({
      n: sql<number>`count(*)::int`,
      converted: sql<number>`count(${contacts.memberId})::int`,
      known: sql<number>`count(${contacts.checkedIn})::int`,
      checkedIn: sql<number>`count(*) filter (where ${contacts.checkedIn})::int`,
    }).from(contacts),
  ]);
  return { members: m.n, viaLinkedin: m.linkedin, contacts: c.n, converted: c.converted, checkedIn: c.known ? c.checkedIn : null };
}
