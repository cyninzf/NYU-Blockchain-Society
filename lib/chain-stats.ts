import { sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { chainStatsMinMembers } from "@/content/site";
import { INDUSTRY_IDS, type IndustryId } from "@/content/industries";
import { getDb, type Db } from "./db";
import { members } from "./db/schema";

import { reportError } from "./monitoring";
// Anonymous growth: aggregates only. No names, emails or per-member data ever leave here, and
// below `chainStatsMinMembers` members nothing count-like leaves either: no count, no breakdowns,
// no node count (the background then shows a fixed ambient baseline). From that threshold on,
// the public gets the counter with its breakdowns, and the background derives its member nodes
// from the same number. Cached under the "chain" tag (joins and deletes refresh it); the "recent"
// flag can lag by up to the cache's hour when the last join turns 8 days old, which is harmless.

export type ChainStats = {
  members: number;
  /** Share of all block picks, in percent (sums to ~100); null when nobody picked a block. */
  shares: Record<IndustryId, number> | null;
  /** Distinct countries from "City and country"; null until anyone has filled it in. */
  countries: number | null;
};

/**
 * `stats` is null below the threshold: then there is no count of any kind in the response.
 * `recent` (round 27): whether anyone joined in the last 7 days, a yes/no only (never how many,
 * who or when), so the background can show a few "new to the chain" pulses.
 */
export type ChainPublic = { stats: ChainStats | null; recent: boolean };

/** How far back "new to the chain" looks. */
export const RECENT_DAYS = 7;

/**
 * Whether the member count is public (at least `chainStatsMinMembers`). Until it is, block numbers
 * (join order, so a count) are never shown, not even to the member: "Block added." instead of
 * "Block #12 added.". Read live, not cached, so it can't lag behind a delete.
 */
export async function countIsPublic(db: Db): Promise<boolean> {
  try {
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(members);
    return r.n >= chainStatsMinMembers;
  } catch {
    return false;
  }
}

export async function chainPublic(): Promise<ChainPublic> {
  "use cache";
  cacheTag("chain");
  cacheLife("hours");
  const db = getDb();
  if (!db) return { stats: null, recent: false };
  try {
    const [r] = await db.select({
      n: sql<number>`count(*)::int`,
      blockchain: sql<number>`count(*) filter (where 'blockchain' = any(${members.blocks}))::int`,
      finance: sql<number>`count(*) filter (where 'finance' = any(${members.blocks}))::int`,
      ai: sql<number>`count(*) filter (where 'ai' = any(${members.blocks}))::int`,
      countries: sql<number>`count(distinct ${members.country}) filter (where ${members.country} <> 'Unrecognized')::int`,
      recent: sql<boolean>`coalesce(bool_or(${members.createdAt} > now() - make_interval(days => ${RECENT_DAYS})), false)`,
    }).from(members);
    const picks = r.blockchain + r.finance + r.ai;
    const stats: ChainStats | null = r.n < chainStatsMinMembers ? null : {
      members: r.n,
      shares: picks ? Object.fromEntries(INDUSTRY_IDS.map((id) => [id, Math.round((r[id] / picks) * 100)])) as Record<IndustryId, number> : null,
      countries: r.countries || null,
    };
    return { stats, recent: Boolean(r.recent) };
  } catch (e) {
    reportError("site", "chain stats failed", e);
    return { stats: null, recent: false };
  }
}
