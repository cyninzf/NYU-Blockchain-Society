// "The chain so far": events and programs, one block each. Every block is clickable.
// The accelerator is "building": never present it as live. New programs get a block only
// once someone owns them.

import { series } from "./conferences";

/** Programs people can ask to hear about from the join flow (`notify`). Old rows may also hold "mentorship". */
export type Notify = "networking" | "accelerator" | "conference";
export const NOTIFY: Notify[] = ["networking", "accelerator", "conference"];

/** Line added to the join success screen when someone came from a block's "Get notified". */
export const notifyMessages: Record<Notify, string> = {
  networking: "We'll tell you about upcoming networking events.",
  accelerator: "We'll tell you when the Accelerator launches.",
  conference: "We'll tell you when the next conference is announced.",
};

export type EventFormat = "mixer" | "workshop" | "roundtable" | "dinner" | "fireside" | "office-hours" | "other";

export const formatLabels: Record<EventFormat, string> = {
  mixer: "Mixer",
  workshop: "Workshop",
  roundtable: "Roundtable",
  dinner: "Dinner",
  fireside: "Fireside",
  "office-hours": "Office hours",
  other: "Event",
};

/**
 * Networking: mixers, workshops, roundtables and more. Only `format` and `title` are required.
 * Block 01 shows the soonest event dated today or later (New York time), and opens its Luma
 * page. Past events can stay here; they're ignored.
 * Example: { format: "mixer", title: "Fall mixer", date: "2026-11-12", venue: "…", lumaUrl: "https://lu.ma/…" }
 */
export type NetworkingEvent = { format: EventFormat; title: string; date?: string; venue?: string; lumaUrl?: string };

export const networkingEvents: NetworkingEvent[] = [];

export type BlockStatus = "annual" | "done" | "upcoming" | "soon" | "building";

export type BlockAction =
  | { kind: "link"; label: string; href: string; external?: boolean }
  | { kind: "join"; label: string; notify: Notify };

export type ChainBlock = {
  label: string;
  /** Short name for the block's header, "BLOCK 00 · CONFERENCE". */
  kind: string;
  status: BlockStatus;
  title: string;
  text: string;
  /** The next networking event, shown as "Next: <title> · <date>" with a format tag. */
  next?: { format: string; title: string; date: string; venue?: string };
  /** Show the conference's mini edition chain (from conferences.ts) inside the card. */
  editions?: boolean;
  action: BlockAction;
};

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** The soonest event on or after `today` (YYYY-MM-DD). */
export const nextNetworkingEvent = (today: string) =>
  networkingEvents
    .filter((e): e is NetworkingEvent & { date: string } => !!e.date && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

function networkingBlock(today: string): ChainBlock {
  const base = { label: "Block 01", kind: "Networking", title: "Networking", text: "Mixers, workshops, roundtables and more, for NYU alumni wherever they are." };
  const e = nextNetworkingEvent(today);
  if (!e) return { ...base, status: "soon", action: { kind: "join", label: "Get notified", notify: "networking" } };
  return {
    ...base,
    status: "upcoming",
    next: { format: formatLabels[e.format], title: e.title, date: formatDate(e.date), venue: e.venue },
    action: e.lumaUrl
      ? { kind: "link", label: "Register on Luma", href: e.lumaUrl, external: true }
      : { kind: "join", label: "Get notified", notify: "networking" },
  };
}

/** The chain as of `today` (YYYY-MM-DD, New York). */
export const chainBlocks = (today: string): ChainBlock[] => [
  {
    label: "Block 00",
    kind: "Conference",
    status: "annual",
    title: series.name,
    text: `Annual · since ${series.since}`,
    editions: true,
    action: { kind: "link", label: "The conference series", href: "/conference" },
  },
  networkingBlock(today),
  {
    label: "Block 02",
    kind: "Accelerator",
    status: "building",
    title: "Accelerator",
    text: "Support for NYU founders working across digital assets and AI.",
    action: { kind: "join", label: "Get notified", notify: "accelerator" },
  },
];
