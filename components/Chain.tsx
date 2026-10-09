import { cacheLife } from "next/cache";
import Link from "next/link";
import { nextEdition, pastEditions, statusLabel } from "@/content/conferences";
import { chainBlocks, type BlockStatus } from "@/content/events";
import { chainIntro } from "@/content/site";
import NextEditionLink from "./conference/NextEditionLink";
import DrawIn from "./DrawIn";
import Icon from "./Icon";
import OpenJoin from "./OpenJoin";

// Each block is drawn by its status: confirmed (done/annual) = solid edges, active (the
// current block: next event) = glowing edges with a slow pulse, building = dashed edges, as
// if still being mined. Change a block's status in content/ and its drawing follows.
type Draw = "confirmed" | "active" | "building";
const STATUS: Record<BlockStatus, { label: string; dot: string; draw: Draw }> = {
  annual: { label: "Annual", dot: "st ok", draw: "confirmed" },
  done: { label: "Done", dot: "st ok", draw: "confirmed" },
  upcoming: { label: "Upcoming", dot: "st pend", draw: "active" },
  soon: { label: "Next date soon", dot: "st pend", draw: "active" },
  building: { label: "Building", dot: "st", draw: "building" },
};

/** Today in New York (YYYY-MM-DD). Cached hourly so the page stays static. */
async function todayNY() {
  "use cache";
  cacheLife("hours");
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

export default async function Chain() {
  const blocks = chainBlocks(await todayNY());
  return (
    <section className="chain" id="chain" aria-labelledby="chain-h">
      <div className="wrap">
        <div className="chain-head" data-bg="dim">
          <h2 id="chain-h">The chain so far</h2>
          <p>{chainIntro}</p>
        </div>
        <ol className="blocks">
          {blocks.map((ev, i) => {
            const st = STATUS[ev.status];
            const cls = `blk-go ${st.draw === "active" ? "btn btn-w" : "go"}`;
            const a = ev.action;
            return (
              <li className={`blk ${st.draw}`} key={ev.label} data-bg="dim">
                <span className="frame" aria-hidden="true">
                  <i className="e t"></i><i className="e r"></i><i className="e b"></i><i className="e l"></i>
                  <b className="c tl"></b><b className="c tr"></b><b className="c br"></b><b className="c bl"></b>
                </span>
                {i < blocks.length - 1 && <span className="flink" aria-hidden="true"><i></i><b></b></span>}
                <div className="bhead mono">
                  <span>{ev.label} · {ev.kind}</span>
                  <span className={st.dot}><i></i>{st.label}</span>
                </div>
                <h3>{ev.title}</h3>
                <p>{ev.text}</p>
                {ev.next && (
                  <p className="next">
                    <span className="tag mono">{ev.next.format}</span>
                    <span>Next: <b>{ev.next.title}</b> · {ev.next.date}{ev.next.venue && <> · {ev.next.venue}</>}</span>
                  </p>
                )}
                {ev.editions && (
                  <ol className="editions" aria-label="Editions">
                    {pastEditions.map((e) => (
                      <li key={e.year}>
                        <Link className="ed past" href={`/conference/${e.year}`}>{e.year} <Icon name="check" /><span className="sr"> (done)</span></Link>
                      </li>
                    ))}
                    {nextEdition && (
                      <li>
                        <NextEditionLink className="ed next">
                          {nextEdition.year ?? "Next edition"} <span className="mono">· {statusLabel[nextEdition.status]}</span>
                        </NextEditionLink>
                      </li>
                    )}
                  </ol>
                )}
                {a.kind === "join" ? (
                  <OpenJoin className={cls} notify={a.notify}>
                    {a.label}<span className="sr">: {ev.title}</span>
                  </OpenJoin>
                ) : a.external ? (
                  <a className={cls} href={a.href} target="_blank" rel="noopener">
                    {a.label} <Icon name="arrow-up-right" /><span className="sr"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <Link className={cls} href={a.href}>
                    {a.label} <Icon name="arrow-right" />
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
        <DrawIn selector=".blocks > .blk" />
      </div>
    </section>
  );
}
