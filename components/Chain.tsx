import Link from "next/link";
import { editionStatus, nextEdition, pastEditions } from "@/content/conferences";
import { chainBlocks, type BlockStatus, type NextEvent } from "@/content/chain";
import { chainIntro } from "@/content/site";
import { eventPath } from "@/lib/event-fields";
import { eventWhen } from "@/lib/event-time";
import { publicEvents, type PublicEvent } from "@/lib/events";
import DrawIn from "./DrawIn";
import Icon from "./Icon";
import NotifyButton from "./NotifyButton";

// Each block is drawn by its status (its behaviour is the same for all three): confirmed (done/annual) = solid edges, active (the
// current block: next event) = glowing edges with a slow pulse, building = dashed edges, as
// if still being mined. Change a block's status in content/ (or Block 01's event in
// /admin/events) and its drawing follows.
type Draw = "confirmed" | "active" | "building";
const STATUS: Record<BlockStatus, { label: string; dot: string; draw: Draw }> = {
  annual: { label: "Annual", dot: "st ok", draw: "confirmed" },
  done: { label: "Done", dot: "st ok", draw: "confirmed" },
  upcoming: { label: "Upcoming", dot: "st pend", draw: "active" },
  soon: { label: "Next date soon", dot: "st pend", draw: "active" },
  cancelled: { label: "Cancelled", dot: "st", draw: "confirmed" },
  building: { label: "Building", dot: "st", draw: "building" },
};

const nextEvent = (e: PublicEvent | undefined): NextEvent | null => e ? {
  title: e.title, slug: e.slug, when: eventWhen(e.startsAt, e.endsAt), venue: e.venueName, cohost: e.cohost,
  registrationUrl: e.registrationUrl, cancelled: e.status === "cancelled",
} : null;

export default async function Chain() {
  // Block 01: the next published event; a cancelled one only when nothing else is coming up.
  const { upcoming } = await publicEvents();
  const blocks = chainBlocks(nextEvent(upcoming.find((e) => e.status === "published") ?? upcoming[0]));
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
                    {ev.next.cancelled && <span className="tag mono">Cancelled</span>}
                    <span>Next: <Link className="next-go" href={eventPath(ev.next.slug)}>{ev.next.title}</Link> · {ev.next.when}{ev.next.venue && <> · {ev.next.venue}</>}</span>
                    {ev.next.cohost && <span className="cohost">Co-hosted with {ev.next.cohost}</span>}
                    {!ev.next.cancelled && !ev.next.registrationUrl && <span className="cohost">Registration opens soon</span>}
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
                        {/* The next edition's hub is /conference (round 13). */}
                        <Link className="ed next" href="/conference">
                          Next: {nextEdition.year ?? "next edition"} <span className="mono">· {editionStatus(nextEdition)}</span>
                        </Link>
                      </li>
                    )}
                  </ol>
                )}
                {/* The same two actions on every block: the text link (stretched over the whole card)
                    and "Get notified", which sits above it as its own tab stop. */}
                <div className="blk-acts">
                  <Link className="blk-go go" href={ev.page.href}>{ev.page.label} <Icon name="arrow-right" /></Link>
                  <NotifyButton className="btn btn-w blk-act" notify={ev.notify} src={ev.src}>
                    Get notified<span className="sr">: {ev.title}</span>
                  </NotifyButton>
                </div>
              </li>
            );
          })}
        </ol>
        <DrawIn selector=".blocks > .blk" />
      </div>
    </section>
  );
}
