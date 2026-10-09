import { sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { chainStatsMinMembers } from "@/content/site";
import { INDUSTRY_IDS, type IndustryId } from "@/content/industries";
import { MAX_MEMBER_NODES } from "@/components/backdrop/network";
import { getDb } from "./db";
import { members } from "./db/schema";

// Anonymous growth: aggregates only. No names, emails or per-member data ever leave here; the
// public gets a node count for the background and, from `chainStatsMinMembers` members on, the
// counter with its breakdowns. Cached under the "chain" tag (joins and deletes refresh it).

export type ChainStats = {
  members: number;
  /** Share of all block picks, in percent (sums to ~100); null when nobody picked a block. */
  shares: Record<IndustryId, number> | null;
  /** Distinct countries from "City and country"; null until anyone has filled it in. */
  countries: number | null;
};

export type ChainPublic = {
  /** How many member nodes the background adds (capped for performance). */
  nodes: number;
  stats: ChainStats | null;
};

export async function chainPublic(): Promise<ChainPublic> {
  "use cache";
  cacheTag("chain");
  cacheLife("hours");
  const db = getDb();
  if (!db) return { nodes: 0, stats: null };
  try {
    const [r] = await db.select({
      n: sql<number>`count(*)::int`,
      blockchain: sql<number>`count(*) filter (where 'blockchain' = any(${members.blocks}))::int`,
      finance: sql<number>`count(*) filter (where 'finance' = any(${members.blocks}))::int`,
      ai: sql<number>`count(*) filter (where 'ai' = any(${members.blocks}))::int`,
      countries: sql<number>`count(distinct ${members.country})::int`,
    }).from(members);
    const picks = r.blockchain + r.finance + r.ai;
    const stats: ChainStats | null = r.n < chainStatsMinMembers ? null : {
      members: r.n,
      shares: picks ? Object.fromEntries(INDUSTRY_IDS.map((id) => [id, Math.round((r[id] / picks) * 100)])) as Record<IndustryId, number> : null,
      countries: r.countries || null,
    };
    return { nodes: Math.min(r.n, MAX_MEMBER_NODES), stats };
  } catch (e) {
    console.error("chain stats failed", e instanceof Error ? e.message : e);
    return { nodes: 0, stats: null };
  }
}
