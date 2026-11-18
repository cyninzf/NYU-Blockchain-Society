import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/Icon";
import OpenJoin from "@/components/OpenJoin";
import { siteName } from "@/content/site";
import { eventDay, eventWhen } from "@/lib/event-time";
import { eventPath, EVENTS_PATH } from "@/lib/event-fields";
import { FeaturedCta, FeaturedPartner, FeaturedProgram, PartnerNotice, featuredPartner } from "@/components/HomeEvents";
import { eveningFormat, featuredEvent, pastEvenings } from "@/content/home-events";
import { publicEvents } from "@/lib/events";
import { featuredEventOver } from "@/lib/home-events";

const description = "Networking events from NYU Blockchain Society: mixers, workshops, roundtables and more, for NYU alumni and industry professionals.";

export const metadata: Metadata = {
  title: "Events",
  description,
  alternates: { canonical: EVENTS_PATH },
  openGraph: { type: "website", url: EVENTS_PATH, siteName, title: "Events", description, locale: "en_US" },
  twitter: { card: "summary_large_image", site: "@NYU_Blockchain", title: "Events", description },
};

// Block 01's page (round 33: /events, headed "Events" like the block; /networking redirects here), upcoming then past
// events. With no upcoming event in the table, the home page's featured event while it's ahead.
// "Past evenings": the evenings in content/home-events.ts (co-host, agenda, speakers), then past
// events from the table.
export default async function EventsPage() {
  const [{ upcoming, past }, over] = await Promise.all([publicEvents(), featuredEventOver()]);
  return (
    <section className="series ev-list page-top" aria-labelledby="events-h">
      <div className="wrap">
        <div data-bg="dim">
          <p className="kicker mono">Block 01 · Events</p>
          <h1 id="events-h">Events</h1>
          <p className="series-sub">Mixers, workshops, roundtables and more, for NYU alumni wherever they are.</p>
          <p className="series-sub ev-format">{eveningFormat}</p>
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
        ) : !over ? (
          <>
            <ol className="ed-chain">
              <li className="ed-blk" data-bg="dim">
                <div className="top mono">
                  <span>{featuredEvent.label}</span>
                  <span className="st pend"><i></i>Upcoming</span>
                </div>
                <h3 className="ev-title">{featuredEvent.title}</h3>
                <p>{[featuredEvent.when, featuredEvent.place].filter(Boolean).join(" · ")}</p>
                <FeaturedPartner partner={featuredPartner()} />
                <p><FeaturedCta /></p>
              </li>
            </ol>
          </>
        ) : (
          <p className="series-sub" data-bg="dim">Next date soon. <OpenJoin className="ev-link" notify="networking">Get notified</OpenJoin></p>
        )}

        {(pastEvenings.length > 0 || past.length > 0) && (
          <>
            <h2 data-bg="dim">Past evenings</h2>
            {pastEvenings.length > 0 && (
              <ol className="ed-chain">
                {pastEvenings.map((e) => (
                  <li key={e.id} className="ed-blk" data-bg="dim">
                    <div className="top mono">
                      <span>{e.label}</span>
                      <span className="st"><i></i>Past</span>
                    </div>
                    <h3 className="ev-title">{e.title}</h3>
                    <p>{e.when}</p>
                    <FeaturedPartner partner={e.partner} />
                    <FeaturedProgram evening={e} />
                  </li>
                ))}
              </ol>
            )}
            {past.length > 0 && (
              <ol className="ev-past" data-bg="dim">
                {past.map((e) => (
                  <li key={e.slug}><b>{e.title}</b><span>{eventDay(e.startsAt)}</span>{e.venueName && <span>{e.venueName}</span>}</li>
                ))}
              </ol>
            )}
          </>
        )}
        <PartnerNotice partners={[...(upcoming.length || over ? [] : [featuredPartner()]), ...pastEvenings.map((e) => e.partner)]} />
      </div>
    </section>
  );
}
