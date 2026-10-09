import { chainPublic } from "@/lib/chain-stats";

/** Aggregates only (lib/chain-stats.ts), for the background's member nodes. Cached at the edge. */
export async function GET() {
  return Response.json(await chainPublic(), {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400" },
  });
}
