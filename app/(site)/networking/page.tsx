import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/Icon";
import OpenJoin from "@/components/OpenJoin";
import { siteName } from "@/content/site";
import { eventDay, eventWhen } from "@/lib/event-time";
import { eventPath, NETWORKING_PATH } from "@/lib/event-fields";
import { publicEvents } from "@/lib/events";

const description = "Networking events from NYU Blockchain Society: mixers, workshops, roundtables and more, for NYU alumni and industry professionals.";

export const metadata: Metadata = {
  title: "Networking",
  description,
  alternates: { canonical: NETWORKING_PATH },
  openGraph: { type: "website", url: NETWORKING_PATH, siteName, title: "Networking", description, locale: "en_US" },
  twitter: { card: "summary_large_image", site: "@NYU_Blockchain", title: "Networking", description },
};

// Block 01's page (round 15: /networking, headed "Networking" like the block), upcoming then past events.
export default async function NetworkingPage() {
  const { upcoming, past } = await publicEvents();
  return (
    <section className="series ev-list page-top" aria-labelledby="events-h">
      <div className="wrap">
        <div data-bg="dim">
          <p className="kicker mono">Block 01 · Networking</p>
          <h1 id="events-h">Networking</h1>
          <p className="series-sub">Mixers, workshops, roundtables and more, for NYU alumni wherever they are.</p>
        </div>

        <h2 data-bg="dim">Upcoming</h2>
        {upcoming.length ? (
          <ol className="ed-chain">
            {upcoming.map((e) => (
              <li key={e.slug} className={e.status === "cancelled" ? "ed-blk next" : "ed-blk"} data-bg="dim">
                <div className="top mono">
                  <span>{eventDay(e.startsAt)}</span>
                  <span className={e.status === "cancelled" ? "st" : "st pend"}><i></i>{e.status === "cancelled" ? "Cancelled" : "Upcoming"}</span>
                </div>
                <h3 className="ev-title">{e.title}</h3>
                <p>{[eventWhen(e.startsAt, e.endsAt), e.venueName].filter(Boolean).join(" · ")}</p>
                {e.cohost && <p>Co-hosted with {e.cohost}</p>}
                <Link className="blk-go go" href={eventPath(e.slug)}>Details{e.status === "published" && e.registrationUrl ? " and registration" : ""} <Icon name="arrow-right" /></Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="series-sub" data-bg="dim">Next date soon. <OpenJoin className="ev-link" notify="networking">Get notified</OpenJoin></p>
        )}

        {past.length > 0 && (
          <>
            <h2 data-bg="dim">Past</h2>
            <ol className="ev-past" data-bg="dim">
              {past.map((e) => (
                <li key={e.slug}><b>{e.title}</b><span>{eventDay(e.startsAt)}</span>{e.venueName && <span>{e.venueName}</span>}</li>
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}
