// The NYU Blockchain Conference: an annual series, one entry per edition, newest last.
// Use "registrations", never "attendees". Don't name any NYU school as host.

import { firms2024 } from "./firms";
import { program2024, type Session } from "./program";

export type EditionStatus = "done" | "announced" | "planning";

export type Edition = {
  /** Editions with a year get their own page at /conference/<year>. */
  year?: number;
  date?: string;
  venue?: string;
  address?: string;
  status: EditionStatus;
  /** Shown instead of the generic status label, e.g. "Planning underway". */
  statusText?: string;
  stats?: { registrations: number; speakers: number; panels: number; fireside: boolean };
  program?: Session[];
  /** Firms speakers came from (text only, never logos). */
  firms?: string[];
  lumaUrl?: string;
};

export const series = {
  name: "NYU Blockchain Conference",
  since: 2024,
};

export const editions: Edition[] = [
  {
    year: 2024,
    date: "November 1, 2024",
    venue: "New York University",
    address: "New York University, 44 West 4th Street",
    status: "done",
    stats: { registrations: 632, speakers: 35, panels: 7, fireside: true },
    program: program2024,
    firms: firms2024,
  },
  // The next edition (round 13): /conference is its hub and Block 00 points to it. Only the year
  // and the status text are public so far. Fill in date and venue (and address, lumaUrl) when
  // they're confirmed: they appear on /conference only once set. Set status "announced" with a
  // lumaUrl when registration opens. Never invent a month, venue or speakers here.
  {
    year: 2027,
    status: "planning",
    statusText: "Planning underway",
    date: undefined,
    venue: undefined,
  },
];

export const pastEditions = editions.filter((e): e is Edition & { year: number } => e.year !== undefined && e.status === "done");
export const nextEdition = editions.find((e) => e.status !== "done");
export const editionByYear = (year: number) => editions.find((e) => e.year === year);

export const editionTitle = (e: Edition) => (e.year ? `${series.name} ${e.year}` : "Next edition");
/** "Planning underway", or the generic label. */
export const editionStatus = (e: Edition) => e.statusText ?? statusLabel[e.status];
/** The join source for "Get notified" on /conference, e.g. conference-2027. */
export const nextEditionSource = nextEdition?.year ? `conference-${nextEdition.year}` : "conference";
export const statusLabel: Record<EditionStatus, string> = { done: "Done", announced: "Announced", planning: "Planning" };
export const statsLine = (s: NonNullable<Edition["stats"]>) =>
  `${s.registrations} registrations · ${s.speakers} speakers and moderators · ${s.panels} panels${s.fireside ? " + a fireside" : ""}`;
