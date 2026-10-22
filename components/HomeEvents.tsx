import Image from "next/image";
import Link from "next/link";
import { comingUp, eventsHeading, featuredEvent as ev } from "@/content/home-events";
import { featuredEventOver } from "@/lib/home-events";
import DrawIn from "./DrawIn";
import Icon from "./Icon";

/**
 * The home page's Events section (content/home-events.ts): the featured event drawn as an active
 * block, then "Coming up" as dashed blocks still being mined. The partner and speakers show only
 * when switched on there, and the partner only on the featured card.
 */
export default async function HomeEvents() {
  const over = await featuredEventOver();
  const partner = ev.showPartner && ev.partnerName;
  const speakers = ev.showSpeakers ? ev.speakers : [];
  return (
    <section className="chain evs" id="events" aria-labelledby="events-h">
      <div className="wrap">
        <div className="chain-head" data-bg="dim">
          <h2 id="events-h">{eventsHeading}</h2>
        </div>
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
            {!over && (
              <div className="blk-acts">
                {ev.registrationUrl
                  ? <a className="btn btn-w" href={ev.registrationUrl} target="_blank" rel="noopener">{ev.registrationLabel} <Icon name="arrow-up-right" /><span className="sr"> (opens in a new tab)</span></a>
                  : <Link className="btn btn-w" href={`/contact?about=${ev.inviteRequest.key}`}>{ev.inviteRequest.label}</Link>}
              </div>
            )}
          </article>
          <div className="ev-up" data-bg="dim">
            <h3>Coming up</h3>
            <ol>
              {comingUp.map((c) => (
                <li key={c.title}>
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
        <DrawIn selector=".ev-feat" />
      </div>
    </section>
  );
}
