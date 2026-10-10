// "The chain so far": events and programs, one block each. The three blocks behave the same
// (round 15): the whole card opens the block's page, and every card has the same two actions, a
// text link to that page and "Get notified" (the join flow with the block's notify and src).
// The accelerator is "building": never present it as live. New programs get a block only once
// someone owns them. Block 01's next event comes from the events table (/admin/events).

import { series } from "./conferences";
import type { Notify } from "./notify";

export type BlockStatus = "annual" | "done" | "upcoming" | "soon" | "cancelled" | "building";

/** The next networking event as Block 01 shows it (already formatted). */
export type NextEvent = {
  title: string; slug: string; when: string; venue: string | null; cohost: string | null; registrationUrl: string | null; cancelled: boolean;
};

export type ChainBlock = {
  label: string;
  /** Short name for the block's header, "BLOCK 00 · CONFERENCE". */
  kind: string;
  status: BlockStatus;
  title: string;
  text: string;
  next?: NextEvent;
  /** Show the conference's mini edition chain (from conferences.ts) inside the card. */
  editions?: boolean;
  /** The block's canonical page: the whole card and the text link open it. */
  page: { label: string; href: string };
  /** "Get notified": the join flow with this notify interest and ?src=. */
  notify: Notify;
  src: string;
};

/** The chain, with the next networking event (published first, else a cancelled one) or null. */
export const chainBlocks = (next: NextEvent | null): ChainBlock[] => [
  {
    label: "Block 00",
    kind: "Conference",
    status: "annual",
    title: series.name,
    text: `Annual · since ${series.since}`,
    editions: true,
    page: { label: "The conference series", href: "/conference" },
    notify: "conference",
    src: "chain-conference",
  },
  {
    label: "Block 01",
    kind: "Networking",
    status: !next ? "soon" : next.cancelled ? "cancelled" : "upcoming",
    title: "Networking",
    text: "Mixers, workshops, roundtables and more, for NYU alumni wherever they are.",
    ...(next ? { next } : {}),
    page: { label: "See all events", href: "/events" },
    notify: "networking",
    src: "chain-networking",
  },
  {
    label: "Block 02",
    kind: "Accelerator",
    status: "building",
    title: "Accelerator",
    text: "Support for NYU founders working across digital assets and AI.",
    page: { label: "About the accelerator", href: "/accelerator" },
    notify: "accelerator",
    src: "chain-accelerator",
  },
];
