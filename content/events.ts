// "The chain so far": events and programs, one block each. Every block is clickable.
// Mentorship and the accelerator are "building": never present them as live.

import { conference } from "./program";

/** Programs people can ask to hear about from the join flow (`notify`). */
export type Notify = "networking" | "mentorship" | "accelerator";
export const NOTIFY: Notify[] = ["networking", "mentorship", "accelerator"];

/** Line added to the join success screen when someone came from a block's "Get notified". */
export const notifyMessages: Record<Notify, string> = {
  networking: "We'll tell you when the next Networking Night is set.",
  mentorship: "We'll tell you when Mentorship launches.",
  accelerator: "We'll tell you when the Accelerator launches.",
};

/**
 * Networking Nights, the recurring alumni networking series. All fields optional.
 * Set nextDate (YYYY-MM-DD) and lumaUrl together to show the next one as "Upcoming";
 * clear them after the event so the block goes back to "Next date soon".
 */
export const networkingNights: { nextDate?: string; venue?: string; lumaUrl?: string } = {};

export type BlockStatus = "done" | "upcoming" | "soon" | "building";

export type BlockAction =
  | { kind: "link"; label: string; href: string; external?: boolean }
  | { kind: "join"; label: string; notify: Notify };

export type ChainBlock = {
  label: string;
  status: BlockStatus;
  title: string;
  text: string;
  stats?: { value: number; label: string }[];
  action: BlockAction;
};

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

function networkingBlock(): ChainBlock {
  const { nextDate, venue, lumaUrl } = networkingNights;
  const base = { label: "Block 01", title: "Networking Nights" };
  const about = "Our recurring networking series for NYU alumni in New York.";
  if (nextDate && lumaUrl) {
    return {
      ...base,
      status: "upcoming",
      text: `${[formatDate(nextDate), venue].filter(Boolean).join(" · ")}. ${about}`,
      action: { kind: "link", label: "Register on Luma", href: lumaUrl, external: true },
    };
  }
  return { ...base, status: "soon", text: about, action: { kind: "join", label: "Get notified", notify: "networking" } };
}

export const events: ChainBlock[] = [
  {
    label: "Block 00",
    status: "done",
    title: "NYU Blockchain Conference",
    text: `${conference.date} · ${conference.venue}`,
    stats: [
      { value: conference.registrations, label: "registrations" },
      { value: conference.speakers, label: "speakers and moderators" },
      { value: conference.panels, label: "panels + a fireside" },
    ],
    action: { kind: "link", label: "See the program", href: "#conference" },
  },
  networkingBlock(),
  {
    label: "Block 02",
    status: "building",
    title: "Mentorship",
    text: "Alumni paired with NYU students entering the industry.",
    action: { kind: "join", label: "Get notified", notify: "mentorship" },
  },
  {
    label: "Block 03",
    status: "building",
    title: "Accelerator",
    text: "Support for NYU founders working across digital assets and AI.",
    action: { kind: "join", label: "Get notified", notify: "accelerator" },
  },
];
