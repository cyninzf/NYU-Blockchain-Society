import type { Metadata } from "next";
import Link from "next/link";
import { FounderForm, InvestorForm } from "@/components/accelerator/InterestForms";
import PathChooser from "@/components/accelerator/PathChooser";
import { accelerator } from "@/content/accelerator";
import { siteName } from "@/content/site";

const { title, description } = accelerator;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/accelerator" },
  openGraph: { type: "website", url: "/accelerator", siteName, title: `${title} · ${siteName}`, description, locale: "en_US" },
  twitter: { card: "summary_large_image", site: "@NYU_Blockchain", title: `${title} · ${siteName}`, description },
};

// Block 02 (round 14): the accelerator is still being built. Two paths, each with its own form
// (round 28: founder and investor), and one line for partners and sponsors (the contact form).
// Round 30: the path cards choose which form shows (PathChooser), one at a time.
export default function AcceleratorPage() {
  const [founder, investor] = accelerator.paths;
  return (
    <section className="series acc page-top" aria-labelledby="acc-h">
      <div className="wrap">
        <div data-bg="dim">
          <p className="kicker mono acc-kicker">
            <span>Block 02 · Accelerator</span>
            <span className="st"><i></i>{accelerator.status}</span>
          </p>
          <h1 id="acc-h">{title}</h1>
          <p className="series-sub acc-intro">{accelerator.intro}</p>
        </div>

        <PathChooser
          paths={accelerator.paths}
          forms={{
            [founder.id]: <>
              <h2 className="conf-proof-h" data-bg="dim">{founder.title}</h2>
              <p className="series-sub" data-bg="dim">{founder.text}</p>
              <div data-bg="dim"><FounderForm /></div>
            </>,
            [investor.id]: <>
              <h2 className="conf-proof-h" data-bg="dim">{investor.title}</h2>
              <p className="series-sub" data-bg="dim">{investor.text}</p>
              <div data-bg="dim"><InvestorForm /></div>
            </>,
          }}
          after={<p className="series-sub acc-partner" data-bg="dim">{accelerator.partnerLine.text} <Link href="/contact">{accelerator.partnerLine.link}</Link></p>}
        />
      </div>
    </section>
  );
}
