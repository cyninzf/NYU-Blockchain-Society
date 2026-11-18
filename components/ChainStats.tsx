import { industries } from "@/content/industries";
import { chainPublic, type ChainStats } from "@/lib/chain-stats";
import type { CSSProperties } from "react";

const fmt = new Intl.NumberFormat("en-US");

/**
 * "<n> blocks on the chain": aggregates only, never names. Renders nothing until the network
 * has `chainStatsMinMembers` members (content/site.ts). Names only ever appear behind member
 * sign-in (a future opt-in directory), never publicly.
 */
export default async function ChainStats() {
  const { stats } = await chainPublic();
  return stats ? <ChainStatsView stats={stats} /> : null;
}

/**
 * The share of block picks as one chain (round 34): three wireframe segments in the chain's block
 * style, sized by share (Blockchain, Finance, AI in the logo's order), joined by connector nodes,
 * each labelled below. Segments differ only by fill density; nothing moves. A column never gets
 * narrower than its label, so a tiny share still reads. Countries stays a quiet stat below.
 */
export function ChainStatsView({ stats }: { stats: ChainStats }) {
  const shares = stats.shares;
  const cols = shares ? industries.map((i) => `minmax(min-content, ${Math.max(shares[i.id], 0.001)}fr)`).join(" ") : "";
  return (
    <section className="stats" id="network" aria-labelledby="stats-h">
      <div className="wrap" data-bg="dim">
        <h2 id="stats-h">{fmt.format(stats.members)} blocks on the chain</h2>
        <p>Every member adds a block, and a node to the network behind this page.</p>
        {shares && (
          <ol className="share" style={{ gridTemplateColumns: cols } as CSSProperties} aria-label="Share of blocks picked">
            {industries.map((i, n) => (
              <li key={i.id} className={`share-${n}`}>
                <span className="seg" aria-hidden="true"><b className="tl"></b><b className="tr"></b><b className="br"></b><b className="bl"></b></span>
                <span className="share-l"><span className="mono">{i.name}</span> <b>{shares[i.id]}%</b></span>
              </li>
            ))}
          </ol>
        )}
        {shares && <p className="fine">Share of blocks picked across Blockchain, Finance and AI.</p>}
        {stats.countries && (
          <p className="stats-more"><span className="mono">Countries</span> <b>{fmt.format(stats.countries)}</b></p>
        )}
      </div>
    </section>
  );
}
