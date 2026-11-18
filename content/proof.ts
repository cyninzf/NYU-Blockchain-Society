// The proof strip right after the hero (components/story/ProofStrip.tsx): always our most recent
// event (round 33: the KPMG networking evening, November 16, 2026). Swap this when the next one
// has happened. The 2024 conference keeps its own page (/conference/2024, content/conferences.ts).
// Speaker firms as text only, never logos.

import { firms2024 } from "./firms";

export type Proof = {
  label: string;
  /** The series line, shown a step brighter above `copy`. */
  theme: string;
  copy: string;
  link: { label: string; href: string };
  /** "Speakers came from": every firm so far, never logos. */
  firms: string[];
};

export const proof: Proof = {
  label: "Networking Evening with KPMG — Nov 2026",
  theme: "Where Finance, Digital Assets and AI Meet",
  copy: "First evening of our quarterly series at KPMG Two Manhattan West — with speakers from BlackRock, Sky Foundation, Kraken and OKX US.",
  link: { label: "See the series", href: "/networking" },
  // The 2024 firms plus the November 2026 evening's (BlackRock and Kraken were already there).
  firms: [...firms2024, "OKX", "KPMG", "Sky Foundation"],
};
