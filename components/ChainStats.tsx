import { industries } from "@/content/industries";
import { chainPublic } from "@/lib/chain-stats";
import BlockGlyph from "./BlockGlyph";

const fmt = new Intl.NumberFormat("en-US");

/**
 * "<n> blocks on the chain": aggregates only, never names. Renders nothing until the network
 * has `chainStatsMinMembers` members (content/site.ts). Names only ever appear behind member
 * sign-in (a future opt-in directory), never publicly.
 */
export default async function ChainStats() {
  const { stats } = await chainPublic();
  if (!stats) return null;
  return (
    <section className="stats" id="network" aria-labelledby="stats-h">
      <div className="wrap" data-bg="dim">
        <h2 id="stats-h">{fmt.format(stats.members)} blocks on the chain</h2>
        <p>Every member adds a block, and a node to the network behind this page.</p>
        {(stats.shares || stats.countries) && (
          <ul className="stats-list">
            {stats.shares && industries.map((i) => (
              <li key={i.id}>
                <BlockGlyph blocks={[i.id]} size={26} />
                <span className="mono">{i.name}</span>
                <b>{stats.shares![i.id]}%</b>
                <span className="bar" aria-hidden="true"><i style={{ width: `${stats.shares![i.id]}%` }}></i></span>
              </li>
            ))}
            {stats.countries && (
              <li>
                <span className="mono">Countries</span>
                <b>{fmt.format(stats.countries)}</b>
              </li>
            )}
          </ul>
        )}
        {stats.shares && <p className="fine">Share of blocks picked across Blockchain, Finance and AI.</p>}
      </div>
    </section>
  );
}
