import type { Metadata } from "next";
import Link from "next/link";
import ConferenceNotify from "@/components/conference/ConferenceNotify";
import InquiryForm from "@/components/conference/InquiryForm";
import Icon from "@/components/Icon";
import { editionStatus, editionTitle, nextEdition, pastEditions, series } from "@/content/conferences";
import { siteName } from "@/content/site";

const description = `The ${series.name}: an annual conference at NYU, since ${series.since}, with leaders from finance, crypto, and policy.`;

export const metadata: Metadata = {
  title: "Conference",
  description,
  alternates: { canonical: "/conference" },
  openGraph: { type: "website", url: "/conference", siteName, title: series.name, description, locale: "en_US" },
  twitter: { card: "summary_large_image", site: "@NYU_Blockchain", title: series.name, description },
};

// The next edition's hub (round 13): its title and status, "Get notified", and the first edition
// as proof. Date and venue appear only once they're set in content/conferences.ts.
export default function ConferencePage() {
  const next = nextEdition;
  const first = pastEditions[0];
  return (
    <section className="series page-top" aria-labelledby="series-h">
      <div className="wrap">
        <div data-bg="dim">
          <p className="kicker mono">Conference · annual since {series.since}</p>
          <h1 id="series-h">{next ? editionTitle(next) : series.name}</h1>
          {next && <p className="series-sub">{editionStatus(next)}</p>}
          {next && (next.date || next.venue) && <p className="conf-when mono">{[next.date, next.venue].filter(Boolean).join(" · ")}</p>}
        </div>
        {next && <ConferenceNotify />}

        {first?.stats && (
          <>
            <h2 className="conf-proof-h" data-bg="dim">The first edition</h2>
            <ol className="ed-chain">
              <li className="ed-blk" data-bg="dim">
                <div className="top mono">
                  <span>Edition 01</span>
                  <span className="st ok"><i></i>Done</span>
                </div>
                <h3 className="conf-proof-t">{editionTitle(first)}</h3>
                <p>{[first.date, first.venue].filter(Boolean).join(" · ")}</p>
                <p className="stats">
                  {first.stats.registrations} registrations · {first.stats.speakers} speakers and moderators · {first.stats.panels} panels{first.stats.fireside ? " plus a fireside" : ""}
                </p>
                <Link className="blk-go go" href={`/conference/${first.year}`}>See the {first.year} program <Icon name="arrow-right" /></Link>
              </li>
            </ol>
          </>
        )}

        <div className="iq" id="inquire">
          <h2 className="conf-proof-h" data-bg="dim">Interested in sponsoring or speaking?</h2>
          <p className="series-sub" data-bg="dim">Tell us a little about you and we&apos;ll reply by email.</p>
          <div data-bg="dim"><InquiryForm /></div>
        </div>
      </div>
    </section>
  );
}
