import { cacheLife } from "next/cache";
import Link from "next/link";
import { nextEdition, pastEditions, statusLabel } from "@/content/conferences";
import { chainBlocks, type BlockStatus } from "@/content/events";
import { chainIntro } from "@/content/site";
import NextEditionLink from "./conference/NextEditionLink";
import Icon from "./Icon";
import OpenJoin from "./OpenJoin";

const STATUS: Record<BlockStatus, { label: string; dot: string; block: string }> = {
  annual: { label: "Annual", dot: "st ok", block: "blk" },
  done: { label: "Done", dot: "st ok", block: "blk" },
  upcoming: { label: "Upcoming", dot: "st pend", block: "blk live" },
  soon: { label: "Next date soon", dot: "st pend", block: "blk live" },
  building: { label: "Building", dot: "st", block: "blk dim" },
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
        <div className="chain-head">
          <h2 id="chain-h">The chain so far</h2>
          <p>{chainIntro}</p>
        </div>
        <ol className="blocks">
          {blocks.map((ev) => {
            const st = STATUS[ev.status];
            const live = st.block.includes("live");
            const cls = `blk-go ${live ? "btn btn-w" : "go"}`;
            const a = ev.action;
            return (
              <li className={st.block} key={ev.label}>
                <div className="top mono">
                  <span>{ev.label}</span>
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
      </div>
    </section>
  );
}
