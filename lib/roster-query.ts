import "server-only";
import { and, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "./db";
import { linkedinGroupMembers as roster, members } from "./db/schema";

export type RosterFilters = { q?: string; role?: "owner" | "manager" | "member"; joined?: "yes" | "no" };

const pick = <T extends string>(v: unknown, allowed: readonly T[]) => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

export function parseRosterFilters(sp: Record<string, string | string[] | undefined>): RosterFilters {
  return {
    q: typeof sp.q === "string" && sp.q.trim() ? sp.q.trim().slice(0, 80) : undefined,
    role: pick(sp.role, ["owner", "manager", "member"] as const),
    joined: pick(sp.joined, ["yes", "no"] as const),
  };
}

/** Roster rows (newest first) with the linked member's name, if any. */
export function listRoster(db: Db, f: RosterFilters) {
  const where: SQL[] = [];
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(roster.name, like), ilike(roster.headline, like))!);
  }
  if (f.role) where.push(f.role === "member" ? isNull(roster.groupRole) : eq(roster.groupRole, f.role));
  if (f.joined) where.push(f.joined === "yes" ? isNotNull(roster.memberId) : isNull(roster.memberId));
  return db
    .select({ r: roster, memberName: members.name })
    .from(roster)
    .leftJoin(members, eq(members.id, roster.memberId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(roster.id));
}

/** Roster size, linked to members, not yet joined; and members who joined from ?src=linkedin-group. */
export async function rosterCounts(db: Db) {
  const [[r], [m]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int`, linked: sql<number>`count(${roster.memberId})::int` }).from(roster),
    db.select({ n: sql<number>`count(*)::int` }).from(members).where(sql`${members.source} like 'linkedin-group%'`),
  ]);
  return { roster: r.n, linked: r.linked, notJoined: r.n - r.linked, viaLink: m.n };
}
