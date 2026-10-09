import "server-only";
import { and, arrayContains, count, desc, eq, isNull, type SQL } from "drizzle-orm";
import { NOTIFY, type Notify } from "@/content/events";
import { INDUSTRY_IDS, type IndustryId } from "@/content/industries";
import type { Db } from "./db";
import { AFFILIATIONS, members, type Affiliation } from "./db/schema";

/** `country`: a country as counted in "Members by country", or "none" for members who left it blank. */
export type MemberFilters = { affiliation?: Affiliation; block?: IndustryId; notify?: Notify; wall?: "pending" | "approved"; country?: string };

const pick = <T extends string>(v: unknown, allowed: readonly T[]) => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

export function parseFilters(sp: Record<string, string | string[] | undefined>): MemberFilters {
  return {
    affiliation: pick(sp.affiliation, AFFILIATIONS),
    block: pick(sp.block, INDUSTRY_IDS),
    notify: pick(sp.notify, NOTIFY),
    wall: pick(sp.wall, ["pending", "approved"] as const),
    country: typeof sp.country === "string" && sp.country.trim() ? sp.country.trim().slice(0, 120) : undefined,
  };
}

export function listMembers(db: Db, f: MemberFilters) {
  const where: SQL[] = [];
  if (f.affiliation) where.push(eq(members.affiliation, f.affiliation));
  if (f.block) where.push(arrayContains(members.blocks, [f.block]));
  if (f.notify) where.push(arrayContains(members.notify, [f.notify]));
  if (f.wall) where.push(eq(members.showOnWall, true), eq(members.wallApproved, f.wall === "approved"));
  if (f.country) where.push(f.country === "none" ? isNull(members.country) : eq(members.country, f.country));
  return db.select().from(members).where(where.length ? and(...where) : undefined).orderBy(desc(members.id));
}

/** "Members by country": counts only, most members first, blanks last. */
export async function membersByCountry(db: Db) {
  const rows = await db.select({ country: members.country, n: count() }).from(members).groupBy(members.country);
  return rows.sort((a, b) => (a.country === null ? 1 : 0) - (b.country === null ? 1 : 0) || b.n - a.n || (a.country ?? "").localeCompare(b.country ?? ""));
}

export const AFFILIATION_LABELS: Record<Affiliation, string> = {
  alumni: "Alumni",
  industry: "Industry professional",
  faculty_staff: "Faculty/Staff",
  student: "Student",
  friend: "Friend of NYU (legacy)",
};
