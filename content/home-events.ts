// The home page's Events section: one featured event and a short "Coming up" list. Plain data,
// no server-only imports (the contact form reads `inviteRequest`). Turn the partner, speakers or
// registration on here; nothing else needs to change. Past/upcoming is decided on the server
// (lib/home-events.ts) from `startsAt` / `endsAt`, in New York time. While it's ahead and the
// events table has no upcoming event, Block 01 and /networking show it too (the table wins).

export type Speaker = { name: string; title: string; company: string; headshot: string };

export type FeaturedEvent = {
  title: string;
  /** Shown as written. Keep it in step with startsAt / endsAt. */
  when: string;
  place: string;
  description: string;
  label: string;
  /** New York time, "YYYY-MM-DDTHH:MM". After `endsAt` the card shows "Past event" and no button. */
  startsAt: string;
  endsAt: string;
  /** Set to an https URL to send the button there (new tab) instead of the contact form. */
  registrationUrl: string | null;
  registrationLabel: string;
  /** The button while there's no registrationUrl: /contact?about=<key>, message prefilled. */
  inviteRequest: { label: string; key: string; message: string };
  /** The co-host's logo shows on this card and on /networking's featured card only, never on "Coming up". */
  showPartner: boolean;
  partnerName: string;
  partnerLogoPath: string;
  /** The license line, shown on the same page as the logo while the partner shows. */
  partnerNotice: string[];
  showSpeakers: boolean;
  speakers: Speaker[];
};

/** One agenda line: the time (shown muted, mono) and what happens; each of `details` is its own line under it. */
export type AgendaItem = { time: string; item: string; details?: string[] };
/** A confirmed panelist: name, then role as written on the co-host's registration page. */
export type Panelist = { name: string; role: string };

export type ComingUp = { title: string; when: string; note: string; /** Its block, "Block 01 · Networking". */ block: string };

export const featuredEvent: FeaturedEvent = {
  title: "Where Finance, Digital Assets and AI Meet",
  when: "Monday, November 16, 2026 · 5:00–8:00 pm ET",
  place: "New York City",
  description: "An evening for NYU alumni and industry professionals working across finance, digital assets and AI: a speaker program followed by networking.",
  label: "Private event · By invitation",
  startsAt: "2026-11-16T17:00",
  endsAt: "2026-11-16T20:00",
  registrationUrl: null,
  registrationLabel: "Register",
  inviteRequest: { label: "Request an invite", key: "invite-nov-16", message: "Invite request: Nov 16" },
  showPartner: true,
  partnerName: "KPMG",
  /** The blue logo, cropped to its bounds (the black one is never used on the dark site). */
  partnerLogoPath: "/partners/kpmg-blue.png",
  partnerNotice: [
    "KPMG logo used under license. The KPMG trademarks are the sole property of KPMG International Cooperative.",
  ],
  showSpeakers: false,
  speakers: [],
};

/**
 * /networking's featured card: the agenda and speakers (round 32, copied exactly from the co-host's
 * registration page; never add a name before it's confirmed). The home spotlight only links here
 * ("View agenda", `/networking#<agendaId>`) while the event is ahead.
 */
export const agendaId = "agenda";
export const agenda: AgendaItem[] = [
  { time: "5:00 PM", item: "Check-in" },
  {
    time: "5:20 PM",
    item: "Opening remarks from KPMG and the NYU Blockchain Society",
    details: ["Ruth Tang — Partner, KPMG", "Fang Zhang — Co-founder, NYU Blockchain Society"],
  },
  { time: "5:30–6:15 PM", item: "Speakers and panel" },
  { time: "6:15–8:00 PM", item: "Networking" },
];
export const panelists: Panelist[] = [
  { name: "John Conneely", role: "Global Head of Business Development, Sky Frontier Foundation" },
  { name: "Rob Hadick", role: "Managing Partner, Dragonfly" },
  { name: "Roshan Robert", role: "CEO, OKX US" },
  { name: "Will Su", role: "Digital Assets Research, BlackRock" },
  { name: "Adrian Wyland", role: "General Manager – Stablecoins, Payward" },
];
export const moderator: Panelist = { name: "Greg Genega", role: "Senior Advisor, KPMG" };

/** /networking's standing line under its subline: the shape of every evening. */
export const eveningFormat = "Each evening: check-in and networking, brief remarks, a moderated panel with audience Q&A, then extended networking.";

export const comingUp: ComingUp[] = [
  { title: "Quarterly Series, Session 2", when: "January 2027", note: "Details to come", block: "Block 01 · Networking" },
  { title: "Annual Conference", when: "Spring 2027", note: "Save the date coming soon", block: "Block 00 · Conference" },
];

/** The spotlight's kicker (round 29.1: the featured event is Block 01's next one, brought forward). */
export const spotlightKicker = "Block 01 · Networking";

/** The featured event's button, wherever it shows (the spotlight, Block 01, /networking). */
export const featuredCta = () => featuredEvent.registrationUrl
  ? { label: featuredEvent.registrationLabel, href: featuredEvent.registrationUrl, external: true }
  : { label: featuredEvent.inviteRequest.label, href: `/contact?about=${featuredEvent.inviteRequest.key}`, external: false };

/** /contact?about=<key> → the message the contact form starts with (known keys only). */
export const contactPrefill = (key: string | null) =>
  key && key === featuredEvent.inviteRequest.key ? featuredEvent.inviteRequest.message : null;
