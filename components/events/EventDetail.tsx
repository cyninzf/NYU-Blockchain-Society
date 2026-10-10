import Link from "next/link";
import type { EventStatus } from "@/lib/db/schema";
import { eventSource } from "@/lib/event-fields";
import { eventWhen } from "@/lib/event-time";
import Icon from "../Icon";
import OpenJoin from "../OpenJoin";

export type EventView = {
  title: string; slug: string; startsAt: Date; endsAt: Date | null; venueName: string | null; address: string | null;
  description: string | null; registrationUrl: string | null; cohost: string | null; status: EventStatus;
};

/** One event as the public page shows it. The admin preview renders the same thing for a draft. */
/** `over`: the event has ended (or, without an end time, started). */
export default function EventDetail({ event: e, over, banner }: { event: EventView; over: boolean; banner?: React.ReactNode }) {
  const cancelled = e.status === "cancelled";
  return (
    <section className="conf page-top" aria-labelledby="ev-h">
      <div className="wrap crumbs mono" data-bg="dim"><Link href="/events"><Icon name="arrow-left" /> All events</Link></div>
      <div className="wrap">
      <div className="ev-detail">
        {banner}
        <p className="kicker mono" data-bg="solid">{cancelled ? "Cancelled" : over ? "Past event" : "Event"}</p>
        <h1 id="ev-h" data-bg="solid">{e.title}</h1>
        <p className="when mono" data-bg="solid">{eventWhen(e.startsAt, e.endsAt)}</p>
        {(e.venueName || e.address) && <p className="ev-where" data-bg="solid">{[e.venueName, e.address].filter(Boolean).join(" · ")}</p>}
        {e.cohost && <p className="ev-cohost" data-bg="solid">Co-hosted with {e.cohost}</p>}
        {e.description && <p className="ev-desc" data-bg="solid">{e.description}</p>}
        {cancelled ? (
          <p className="ev-note" data-bg="solid">This event was cancelled. <OpenJoin className="ev-link" notify="networking">Hear about the next one</OpenJoin></p>
        ) : over ? null : e.registrationUrl ? (
          <p><a className="btn btn-w" href={e.registrationUrl} target="_blank" rel="noopener">Register <Icon name="arrow-up-right" /><span className="sr"> (opens in a new tab)</span></a></p>
        ) : (
          // No registration link yet: members hear first, and the join is tracked as event-<slug>.
          <>
            <p className="ev-note" data-bg="solid">Registration opens soon.</p>
            <p><OpenJoin className="btn btn-w" notify="networking" src={eventSource(e.slug)}>Join the society to get the invite <Icon name="arrow-right" /></OpenJoin></p>
          </>
        )}
      </div>
      </div>
    </section>
  );
}
