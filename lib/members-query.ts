import "server-only";
import { and, arrayContains, count, desc, eq, getTableColumns, isNull, sql, type SQL } from "drizzle-orm";
import { NOTIFY, type Notify } from "@/content/notify";
import { INDUSTRY_IDS, type IndustryId } from "@/content/industries";
import type { Db } from "./db";
import { AFFILIATIONS, members, type Affiliation } from "./db/schema";
import { countryOf, UNRECOGNIZED } from "./location";

/** `country`: a country as counted in "Members by country", or "none" for members who left it blank. */
export type MemberFilters = { affiliation?: Affiliation; block?: IndustryId; notify?: Notify; country?: string };

const pick = <T extends string>(v: unknown, allowed: readonly T[]) => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

/**
 * Every member column except the retired network-wall ones (show_on_wall, wall_name,
 * wall_approved): they stay in the database (no destructive migration) but are never read.
 */
const RETIRED = ["showOnWall", "wallName", "wallApproved"] as const;
type Columns = ReturnType<typeof getTableColumns<typeof members>>;
export const memberColumns = Object.fromEntries(
  Object.entries(getTableColumns(members)).filter(([k]) => !(RETIRED as readonly string[]).includes(k)),
) as Omit<Columns, (typeof RETIRED)[number]>;

export function parseFilters(sp: Record<string, string | string[] | undefined>): MemberFilters {
  return {
    affiliation: pick(sp.affiliation, AFFILIATIONS),
    block: pick(sp.block, INDUSTRY_IDS),
    notify: pick(sp.notify, NOTIFY),
    country: typeof sp.country === "string" && sp.country.trim() ? sp.country.trim().slice(0, 120) : undefined,
  };
}

function memberWhere(f: MemberFilters): SQL | undefined {
  const where: SQL[] = [];
  if (f.affiliation) where.push(eq(members.affiliation, f.affiliation));
  if (f.block) where.push(arrayContains(members.blocks, [f.block]));
  if (f.notify) where.push(arrayContains(members.notify, [f.notify]));
  if (f.country) where.push(f.country === "none" ? isNull(members.country) : eq(members.country, f.country));
  return where.length ? and(...where) : undefined;
}

/** Members newest first: every match, or one page (`page`: limit and offset). */
export function listMembers(db: Db, f: MemberFilters, page?: { limit: number; offset: number }) {
  const q = db.select(memberColumns).from(members).where(memberWhere(f)).orderBy(desc(members.id)).$dynamic();
  return page ? q.limit(page.limit).offset(page.offset) : q;
}

/** How many members match, for the pager. */
export async function countMembers(db: Db, f: MemberFilters) {
  const [{ n }] = await db.select({ n: count() }).from(members).where(memberWhere(f));
  return n;
}

/**
 * Re-derives `members.country` from what each member typed ("City and country") wherever the
 * stored value differs, e.g. rows saved before the country list learned "New York City". Only the
 * derived column changes; `location` is never touched. A no-op once everything matches.
 */
export async function syncCountries(db: Db) {
  const rows = await db.select({ id: members.id, location: members.location, country: members.country }).from(members);
  const stale = rows.flatMap((r) => { const c = countryOf(r.location); return c === r.country ? [] : [{ id: r.id, c }]; });
  if (!stale.length) return 0;
  await db.execute(sql`update members as m set country = v.c from (values ${sql.join(stale.map((r) => sql`(${r.id}::int, ${r.c}::text)`), sql`, `)}) as v(id, c) where m.id = v.id`);
  return stale.length;
}

/** "Members by country": counts only, most members first, then "Unrecognized", blanks last. */
export async function membersByCountry(db: Db) {
  await syncCountries(db);
  const rows = await db.select({ country: members.country, n: count() }).from(members).groupBy(members.country);
  const rank = (c: string | null) => (c === null ? 2 : c === UNRECOGNIZED ? 1 : 0);
  return rows.sort((a, b) => rank(a.country) - rank(b.country) || b.n - a.n || (a.country ?? "").localeCompare(b.country ?? ""));
}

export const AFFILIATION_LABELS: Record<Affiliation, string> = {
  alumni: "Alumni",
  industry: "Industry professional",
  faculty_staff: "Faculty/Staff",
  student: "Student",
  friend: "Friend of NYU (legacy)",
};
