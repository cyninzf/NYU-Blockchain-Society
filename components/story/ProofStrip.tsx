"use client";

// Proof right after the hero: the 2024 conference in one compact band, with the firms its
// speakers came from on a slow single-line scroll (paused on hover or touch, static under
// reduced motion).

import Link from "next/link";
import { useRef, useState } from "react";
import { editionTitle, pastEditions, statsLine } from "@/content/conferences";
import Icon from "../Icon";

const edition = pastEditions[pastEditions.length - 1];

export default function ProofStrip() {
  const [held, setHeld] = useState(false);
  const release = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  if (!edition) return null;
  const firms = edition.firms ?? [];
  const hold = () => { clearTimeout(release.current); setHeld(true); };
  const letGo = () => { clearTimeout(release.current); release.current = setTimeout(() => setHeld(false), 1500); };

  return (
    <section className="proof" aria-labelledby="proof-h">
      <div className="wrap proof-in">
        <div className="proof-head">
          <h2 id="proof-h" className="mono">{editionTitle(edition)}</h2>
          {edition.stats && <p className="proof-stats">{statsLine(edition.stats)}</p>}
          <Link className="proof-go" href={`/conference/${edition.year}`}>
            See the {edition.year} program <Icon name="arrow-right" />
          </Link>
        </div>
        {firms.length > 0 && (
          <div
            className={held ? "marquee held" : "marquee"}
            onTouchStart={hold}
            onTouchEnd={letGo}
            onTouchCancel={letGo}
          >
            <p className="proof-from mono">Speakers came from<span className="sr"> {firms.join(", ")}</span></p>
            <div className="rail" aria-hidden="true">
              <div className="track">
                {[0, 1].map((copy) => (
                  <ul key={copy}>
                    {firms.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
