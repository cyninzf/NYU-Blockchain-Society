import Image from "next/image";
import Link from "next/link";
import { comingUp, featuredCta, featuredEvent as ev, spotlightKicker } from "@/content/home-events";
import Icon from "./Icon";

/** The featured event's button: "Request an invite" (the contact form), or "Register" in a new tab. */
export function FeaturedCta({ className = "btn btn-w" }: { className?: string }) {
  const cta = featuredCta();
  return cta.external
    ? <a className={className} href={cta.href} target="_blank" rel="noopener">{cta.label} <Icon name="arrow-up-right" /><span className="sr"> (opens in a new tab)</span></a>
    : <Link className={className} href={cta.href}>{cta.label}</Link>;
}

/**
 * "Co-hosted with" and the co-host's logo (content/home-events.ts, while showPartner is on): the
 * blue logo on a small white tile, since the site is dark in every theme. Never recolored.
 */
export function FeaturedPartner() {
  if (!ev.showPartner || !ev.partnerName) return null;
  return (
    <p className="ev-partner">
      <span className="mono">Co-hosted with</span>
      <span className="ev-tile"><Image src={ev.partnerLogoPath} alt={ev.partnerName} width={1198} height={491} /></span>
    </p>
  );
}

/** The license line, on every page that shows the logo. */
export function PartnerNotice() {
  if (!ev.showPartner || !ev.partnerName || !ev.partnerNotice.length) return null;
  return <div className="ev-notice" data-bg="dim">{ev.partnerNotice.map((l) => <p key={l}>{l}</p>)}</div>;
}

/**
 * The spotlight on Block 01 (content/home-events.ts): a full-width band inside "The chain so far"
 * right under the blocks, with a connector from Block 01's card down into it to the featured event,
 * drawn as an active block (a past one as a confirmed block), and "Coming up" as dashed blocks still
 * being mined, each with its block. The kicker and "Coming up" share the first grid row, the
 * featured card and the list the second, so both columns line up. The partner and speakers show
 * only when switched on there, the partner only on the featured card. `over` comes from the server
 * (featuredEventOver).
 */
export default function HomeEvents({ over }: { over: boolean }) {
  const speakers = ev.showSpeakers ? ev.speakers : [];
  return (
    <div className="spot" id="events">
      <div className="wrap spot-in">
        <span className="spot-link" aria-hidden="true"><i></i><b></b></span>
        <div className="evs-grid">
          <p className="spot-k mono" data-bg="dim">{spotlightKicker}{over ? "" : " · Up next"}</p>
          <h3 className="ev-up-h mono" data-bg="dim">Coming up</h3>
          <article className={`blk ev-feat ${over ? "confirmed" : "active"}`} data-bg="dim" aria-labelledby="ev-feat-h">
            <span className="frame" aria-hidden="true">
              <i className="e t"></i><i className="e r"></i><i className="e b"></i><i className="e l"></i>
              <b className="c tl"></b><b className="c tr"></b><b className="c br"></b><b className="c bl"></b>
            </span>
            <div className="bhead mono">
              <span>{ev.label}</span>
              <span className={over ? "st" : "st pend"}><i></i>{over ? "Past event" : "Upcoming"}</span>
            </div>
            <h3 id="ev-feat-h">{ev.title}</h3>
            <p className="ev-when">{ev.when} · {ev.place}</p>
            <p>{ev.description}</p>
            <FeaturedPartner />
            {speakers.length > 0 && (
              <ul className="ev-speakers" aria-label="Speakers">
                {speakers.map((s) => (
                  <li key={s.name}>
                    <Image src={s.headshot} alt="" width={48} height={48} />
                    <span><b>{s.name}</b><span>{s.title}, {s.company}</span></span>
                  </li>
                ))}
              </ul>
            )}
            {!over && <div className="blk-acts"><FeaturedCta /></div>}
          </article>
          <ol className="ev-up" data-bg="dim" aria-label="Coming up">
            {comingUp.map((c) => (
              <li key={c.title}>
                <span className="ev-blk mono">{c.block}</span>
                <b>{c.title}</b>
                <span className="mono">{c.when}</span>
                <span className="ev-note">{c.note}</span>
              </li>
            ))}
          </ol>
        </div>
        <PartnerNotice />
      </div>
    </div>
  );
}
