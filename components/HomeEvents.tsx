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
 * The spotlight on Block 01 (content/home-events.ts), inside "The chain so far" right under the
 * blocks: a connector from Block 01's card down to the featured event, drawn as an active block (a
 * past one as a confirmed block), then "Coming up" as dashed blocks still being mined, each with
 * its block. The partner and speakers show only when switched on there, the partner only on the
 * featured card. `over` comes from the server (featuredEventOver).
 */
export default function HomeEvents({ over }: { over: boolean }) {
  const partner = ev.showPartner && ev.partnerName;
  const speakers = ev.showSpeakers ? ev.speakers : [];
  return (
    <div className="spot" id="events">
      <span className="spot-link" aria-hidden="true"><i></i><b></b></span>
      <p className="spot-k mono" data-bg="dim">{spotlightKicker}{over ? "" : " · Up next"}</p>
      <div className="evs-grid">
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
          {partner && (
            <p className="ev-partner">
              <span className="mono">In partnership with</span>
              <Image src={ev.partnerLogoPath} alt={ev.partnerName} width={120} height={40} />
            </p>
          )}
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
        <div className="ev-up" data-bg="dim">
          <h3>Coming up</h3>
          <ol>
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
      </div>
      {partner && ev.partnerNotice.length > 0 && (
        <div className="ev-notice" data-bg="dim">{ev.partnerNotice.map((l) => <p key={l}>{l}</p>)}</div>
      )}
    </div>
  );
}
