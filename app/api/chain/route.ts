import { chainPublic } from "@/lib/chain-stats";

/**
 * Aggregates only (lib/chain-stats.ts): `{ stats: null, recent }` below 50 members, no count of any kind;
 * `recent` is a yes/no. Never member ids, block numbers or join times. Cached at the edge for 10 minutes.
 */
export async function GET() {
  return Response.json(await chainPublic(), {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400" },
  });
}
