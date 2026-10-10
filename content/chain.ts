// "The chain so far": events and programs, one block each. Every block is clickable.
// The accelerator is "building": never present it as live. New programs get a block only
// once someone owns them. Block 01's next event comes from the events table (/admin/events).

import { series } from "./conferences";
import type { Notify } from "./notify";

export type BlockStatus = "annual" | "done" | "upcoming" | "soon" | "cancelled" | "building";

export type BlockAction =
  | { kind: "link"; label: string; href: string; external?: boolean }
  | { kind: "join"; label: string; notify: Notify };

/** The next networking event as Block 01 shows it (already formatted). */
export type NextEvent = { title: string; slug: string; when: string; venue: string | null; cohost: string | null; registrationUrl: string | null; cancelled: boolean };

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
  action: BlockAction;
};

const notifyNetworking: BlockAction = { kind: "join", label: "Get notified", notify: "networking" };

function networkingBlock(next: NextEvent | null): ChainBlock {
  const base = { label: "Block 01", kind: "Networking", title: "Networking", text: "Mixers, workshops, roundtables and more, for NYU alumni wherever they are." };
  if (!next) return { ...base, status: "soon", action: notifyNetworking };
  if (next.cancelled) return { ...base, status: "cancelled", next, action: notifyNetworking };
  return {
    ...base,
    status: "upcoming",
    next,
    action: next.registrationUrl ? { kind: "link", label: "Register", href: next.registrationUrl, external: true } : { kind: "link", label: "Event details", href: `/events/${next.slug}` },
  };
}

/** The chain, with the next networking event (published first, else a cancelled one) or null. */
export const chainBlocks = (next: NextEvent | null): ChainBlock[] => [
  {
    label: "Block 00",
    kind: "Conference",
    status: "annual",
    title: series.name,
    text: `Annual · since ${series.since}`,
    editions: true,
    action: { kind: "link", label: "The conference series", href: "/conference" },
  },
  networkingBlock(next),
  {
    label: "Block 02",
    kind: "Accelerator",
    status: "building",
    title: "Accelerator",
    text: "Support for NYU founders working across digital assets and AI.",
    action: { kind: "join", label: "Get notified", notify: "accelerator" },
  },
];
