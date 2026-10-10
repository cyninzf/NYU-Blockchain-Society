import type { Metadata } from "next";
import Icon from "@/components/Icon";
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

// Block 02 (round 14): the accelerator is still being built. Two paths, each with its own form.
export default function AcceleratorPage() {
  const [founder, supporter] = accelerator.paths;
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

        <ol className="acc-paths" aria-label="Two ways in">
          {accelerator.paths.map((p, i) => (
            <li className="ed-blk next" key={p.id} data-bg="dim">
              <div className="top mono"><span>Path {String(i + 1).padStart(2, "0")}</span></div>
              <h2>{p.title}</h2>
              <p>{p.text}</p>
              <a className="blk-go go" href={`#${p.id}`}>{p.cta} <Icon name="arrow-down" /></a>
            </li>
          ))}
        </ol>

        <div className="iq acc-form" id={founder.id}>
          <h2 className="conf-proof-h" data-bg="dim">{founder.title}</h2>
          <p className="series-sub" data-bg="dim">{founder.text}</p>
        </div>

        <div className="iq acc-form" id={supporter.id}>
          <h2 className="conf-proof-h" data-bg="dim">{supporter.title}</h2>
          <p className="series-sub" data-bg="dim">{supporter.text}</p>
        </div>
      </div>
    </section>
  );
}
