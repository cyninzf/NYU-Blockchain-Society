// "The chain so far": events and programs, one block each.
// Mentorship and the accelerator are "building": never present them as live.

import { conference } from "./program";

export type EventStatus = "confirmed" | "pending" | "building";

export type ChainBlock = {
  label: string;
  status: EventStatus;
  title: string;
  text: string;
  stats?: { value: number; label: string }[];
  cta?: { label: string; href: string };
};

export const events: ChainBlock[] = [
  {
    label: "Block 00",
    status: "confirmed",
    title: "NYU Blockchain Conference",
    text: "A full day at NYU with leaders from finance, crypto, and policy.",
    stats: [
      { value: conference.registrations, label: "registrations" },
      { value: conference.speakers, label: "speakers" },
      { value: conference.panels, label: "panels" },
    ],
  },
  {
    label: "Block 01",
    status: "pending",
    title: "Fall Mixer",
    // TODO: confirm date and venue with the maintainer.
    text: "[Date] · [Venue], New York. An evening with alumni, founders, investors, and builders.",
    cta: { label: "Register on Luma", href: "https://luma.com/dwb1s0gv" },
  },
  {
    label: "Block 02",
    status: "building",
    title: "Mentorship",
    text: "Alumni paired with NYU students entering the industry.",
  },
  {
    label: "Block 03",
    status: "building",
    title: "Accelerator",
    text: "Support for NYU founders working across digital assets and AI.",
  },
];
