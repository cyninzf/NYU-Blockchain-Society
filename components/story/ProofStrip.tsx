"use client";

// Proof right after the hero: our most recent event in one compact band (content/proof.ts), with
// the firms speakers came from on a slow single-line scroll (paused on hover or touch, static
// under reduced motion).

import Link from "next/link";
import { useRef, useState } from "react";
import { proof } from "@/content/proof";
import Icon from "../Icon";

export default function ProofStrip() {
  const [held, setHeld] = useState(false);
  const release = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const firms = proof.firms;
  const hold = () => { clearTimeout(release.current); setHeld(true); };
  const letGo = () => { clearTimeout(release.current); release.current = setTimeout(() => setHeld(false), 1500); };

  return (
    <section className="proof" aria-labelledby="proof-h">
      <div className="wrap proof-in" data-bg="dim">
        <div className="proof-head">
          <h2 id="proof-h" className="mono">{proof.label}</h2>
          <p className="proof-stats">{proof.copy}</p>
          <Link className="proof-go" href={proof.link.href}>
            {proof.link.label} <Icon name="arrow-right" />
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
