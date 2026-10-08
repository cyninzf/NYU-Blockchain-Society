import type { Metadata } from "next";
import Link from "next/link";
import NextEditionLink from "@/components/conference/NextEditionLink";
import { editions, editionTitle, series, statsLine, statusLabel } from "@/content/conferences";
import { siteName } from "@/content/site";

const description = `The ${series.name}: an annual conference at NYU, since ${series.since}, with leaders from finance, crypto, and policy.`;

export const metadata: Metadata = {
  title: "Conference",
  description,
  alternates: { canonical: "/conference" },
  openGraph: { type: "website", url: "/conference", siteName, title: series.name, description, locale: "en_US" },
  twitter: { card: "summary_large_image", site: "@NYU_Blockchain", title: series.name, description },
};

export default function ConferencePage() {
  const newestFirst = [...editions].reverse();
  return (
    <section className="series page-top" aria-labelledby="series-h">
      <div className="wrap">
        <p className="kicker mono">Conference</p>
        <h1 id="series-h">{series.name}</h1>
        <p className="series-sub">Annual, since {series.since}</p>
        <ol className="ed-chain">
          {newestFirst.map((e, i) => (
            <li key={e.year ?? "next"} className={e.status === "done" ? "ed-blk" : "ed-blk next"}>
              <div className="top mono">
                <span>Edition {String(newestFirst.length - i).padStart(2, "0")}</span>
                <span className={e.status === "done" ? "st ok" : "st pend"}><i></i>{statusLabel[e.status]}</span>
              </div>
              <h2>{editionTitle(e)}</h2>
              {e.year ? (
                <>
                  <p>{[e.date, e.venue].filter(Boolean).join(" · ")}</p>
                  {e.stats && <p className="mono stats">{statsLine(e.stats)}</p>}
                  <Link className="blk-go go" href={`/conference/${e.year}`}>Program and speakers <span aria-hidden="true">→</span></Link>
                </>
              ) : (
                <>
                  <p>Date and venue to be announced.</p>
                  <NextEditionLink className="blk-go go">Get notified <span aria-hidden="true">→</span></NextEditionLink>
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
