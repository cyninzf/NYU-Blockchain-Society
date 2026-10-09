import type { Metadata } from "next";
import Image from "next/image";
import Boilerplate from "@/components/Boilerplate";
import CopyButton from "@/components/CopyButton";
import { boilerplateStatus } from "@/content/boilerplate";
import { colors, marks, PNG_SIZES, ZIP_FILE } from "@/content/brand";
import { siteName } from "@/content/site";
import s from "./media-kit.module.css";

// The boilerplate is public only once approved (review drafts at /admin/media-kit-preview).
const showBoilerplate = boilerplateStatus === "approved";
const description = `Logos, colors${showBoilerplate ? ", type and boilerplate" : " and type"} for writing about NYU Blockchain Society.`;

export const metadata: Metadata = {
  title: "Media kit",
  description,
  alternates: { canonical: "/media-kit" },
  openGraph: { type: "website", url: "/media-kit", siteName, title: `Media kit · ${siteName}`, description, locale: "en_US" },
  twitter: { card: "summary_large_image", site: "@NYU_Blockchain", title: `Media kit · ${siteName}`, description },
};

export default function MediaKitPage() {
  return (
    <div className={`${s.page} page-top`}>
      <div className="wrap">
        <header className={s.head} data-bg="dim">
          <p className="kicker mono">Media kit</p>
          <h1>Logos, colors and type</h1>
          <p className={s.lede}>Everything you need to write about or feature NYU Blockchain Society. Please follow the usage rules below.</p>
          <a className="btn btn-w" href={ZIP_FILE} download>Download all (ZIP)</a>
        </header>

        <section className={s.section} data-bg="dim" aria-labelledby="mk-logos">
          <h2 id="mk-logos">Logo marks</h2>
          <p className={s.note}>Three isometric blocks drawn as a network: Blockchain (top), Finance and AI. SVG is preferred; PNGs are transparent.</p>
          <ul className={s.marks}>
            {marks.map((m) => (
              <li key={m.file} className={s.mark}>
                <div className={s.previews}>
                  {(["dark", "light"] as const).map((bg) => (
                    <div key={bg} className={`${s.tile} ${bg === "dark" ? s.dark : s.light}`}>
                      <Image src={`/brand/${m.file}.svg`} width={88} height={88} alt={`${m.name} on a ${bg} background`} />
                      {m.best === bg && <span className={`${s.best} mono`}>Use here</span>}
                    </div>
                  ))}
                </div>
                <h3>{m.name}</h3>
                <p className={s.use}>{m.use}</p>
                <p className={`${s.dl} mono`}>
                  <a href={`/brand/${m.file}.svg`} download>SVG</a>
                  {PNG_SIZES.map((size) => (
                    <a key={size} href={`/media-kit/${m.file}-${size}.png`} download>PNG {size}</a>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className={s.section} data-bg="dim" aria-labelledby="mk-usage">
          <h2 id="mk-usage">Usage rules</h2>
          <ul className={s.rules}>
            <li><b>Clear space.</b> Keep empty space around the mark of at least a quarter of its height on every side.</li>
            <li><b>Minimum size.</b> Use the node mark at 48 px and up. Below 48 px, use the solid mark (never smaller than 16 px).</li>
            <li><b>Contrast.</b> White marks on dark backgrounds, violet marks on light ones.</li>
            <li><b>Don&apos;t alter it.</b> Don&apos;t recolor, stretch, rotate, outline or add effects to the mark.</li>
            <li><b>Not the NYU logo.</b> Don&apos;t combine the mark with, or use in its place, the NYU logo or torch.</li>
          </ul>
        </section>

        <section className={s.section} data-bg="dim" aria-labelledby="mk-colors">
          <h2 id="mk-colors">Colors</h2>
          <p className={s.note}>Click a swatch to copy its hex value.</p>
          {colors.map((g) => (
            <div key={g.group} className={s.group}>
              <h3 className="mono">{g.group}</h3>
              <ul className={s.swatches}>
                {g.swatches.map((c) => (
                  <li key={g.group + c.name}>
                    <CopyButton className={s.swatch} text={c.hex} label={`Copy ${c.name} ${c.hex}`}>
                      <span className={s.chip} style={{ background: c.hex }} aria-hidden="true"></span>
                      <span className={s.sname}>{c.name}</span>
                      <span className={`${s.hex} mono`}>{c.hex}{c.token ? ` · ${c.token}` : ""}</span>
                      {c.note && <span className={s.snote}>{c.note}</span>}
                    </CopyButton>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className={s.section} data-bg="dim" aria-labelledby="mk-type">
          <h2 id="mk-type">Typography</h2>
          <div className={s.type}>
            <div>
              <p className={s.specimen}>Geist</p>
              <p className={s.use}>Headlines in 580–620 weight with tight tracking (−0.04 to −0.055 em); body text in 400 at 17 px / 1.55. Open source (SIL Open Font License).</p>
            </div>
            <div>
              <p className={`${s.specimen} mono`}>Geist Mono</p>
              <p className={s.use}>Labels, times, block numbers and data, at 12–13 px. Never for body text.</p>
            </div>
          </div>
        </section>

        {showBoilerplate && <Boilerplate className={s.section} />}
      </div>
    </div>
  );
}
