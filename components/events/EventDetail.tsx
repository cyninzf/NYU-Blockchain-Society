import Link from "next/link";
import type { EventStatus } from "@/lib/db/schema";
import { eventWhen } from "@/lib/event-time";
import Icon from "../Icon";
import OpenJoin from "../OpenJoin";

export type EventView = {
  title: string; startsAt: Date; endsAt: Date | null; venueName: string | null; address: string | null;
  description: string | null; registrationUrl: string | null; cohost: string | null; status: EventStatus;
};

/** One event as the public page shows it. The admin preview renders the same thing for a draft. */
/** `over`: the event has ended (or, without an end time, started). */
export default function EventDetail({ event: e, over, banner }: { event: EventView; over: boolean; banner?: React.ReactNode }) {
  const cancelled = e.status === "cancelled";
  return (
    <section className="conf page-top" aria-labelledby="ev-h">
      <div className="wrap crumbs mono"><Link href="/events"><Icon name="arrow-left" /> All events</Link></div>
      <div className="wrap ev-detail" data-bg="dim">
        {banner}
        <p className="kicker mono">{cancelled ? "Cancelled" : over ? "Past event" : "Event"}</p>
        <h1 id="ev-h">{e.title}</h1>
        <p className="when mono">{eventWhen(e.startsAt, e.endsAt)}</p>
        {(e.venueName || e.address) && <p className="ev-where">{[e.venueName, e.address].filter(Boolean).join(" · ")}</p>}
        {e.cohost && <p className="ev-cohost">Co-hosted with {e.cohost}</p>}
        {e.description && <p className="ev-desc">{e.description}</p>}
        {cancelled ? (
          <p className="ev-note">This event was cancelled. <OpenJoin className="ev-link" notify="networking">Hear about the next one</OpenJoin></p>
        ) : !over && e.registrationUrl ? (
          <p><a className="btn btn-w" href={e.registrationUrl} target="_blank" rel="noopener">Register <Icon name="arrow-up-right" /><span className="sr"> (opens in a new tab)</span></a></p>
        ) : null}
      </div>
    </section>
  );
}
