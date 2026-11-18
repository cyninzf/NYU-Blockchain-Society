import { industries } from "@/content/industries";
import { chainPublic, type ChainStats } from "@/lib/chain-stats";
import type { CSSProperties } from "react";

const fmt = new Intl.NumberFormat("en-US");

/** At most this many nodes are drawn, so a large count stays a quiet cluster; the label keeps the real number. */
const MAX_NODES = 30;

/**
 * One node per country (round 34), as a loose cluster: nodes on a sunflower spiral (golden angle),
 * slightly squashed, each joined to its nearest earlier node by a hairline, so the cluster is one
 * connected network and never a straight row. Deterministic, so server and browser agree.
 */
function Constellation({ n }: { n: number }) {
  const count = Math.min(Math.max(n, 1), MAX_NODES);
  const step = 8.5;
  const pts = Array.from({ length: count }, (_, i) => {
    const r = step * Math.sqrt(i + 0.6);
    const a = i * 2.39996 + 0.5;
    return { x: r * Math.cos(a) * 1.25, y: r * Math.sin(a) * 0.8 };
  });
  const pad = 5;
  const minX = Math.min(...pts.map((p) => p.x)) - pad, maxX = Math.max(...pts.map((p) => p.x)) + pad;
  const minY = Math.min(...pts.map((p) => p.y)) - pad, maxY = Math.max(...pts.map((p) => p.y)) + pad;
  const edges = pts.slice(1).map((p, k) => {
    const i = k + 1;
    let j = 0, best = Infinity;
    for (let m = 0; m < i; m++) {
      const d = (pts[m].x - p.x) ** 2 + (pts[m].y - p.y) ** 2;
      if (d < best) { best = d; j = m; }
    }
    return [j, i] as const;
  });
  const r2 = (v: number) => Math.round(v * 10) / 10;
  return (
    <svg className="cstl" width={r2(maxX - minX)} height={r2(maxY - minY)} viewBox={`${r2(minX)} ${r2(minY)} ${r2(maxX - minX)} ${r2(maxY - minY)}`} aria-hidden="true">
      {edges.map(([a, b]) => <line key={`${a}-${b}`} x1={r2(pts[a].x)} y1={r2(pts[a].y)} x2={r2(pts[b].x)} y2={r2(pts[b].y)} />)}
      {pts.map((p, i) => <circle key={i} cx={r2(p.x)} cy={r2(p.y)} r={2.5} />)}
    </svg>
  );
}

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
          <p className="stats-more">
            <Constellation n={stats.countries} />
            <span className="mono">Members across {fmt.format(stats.countries)} {stats.countries === 1 ? "country" : "countries"}</span>
          </p>
        )}
      </div>
    </section>
  );
}
