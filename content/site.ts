// Site-wide copy and links.

/** Canonical production URL. The bare domain 308-redirects here. */
export const siteUrl = "https://www.nyublockchainsociety.com";

export const siteName = "NYU Blockchain Society";
/** The home page <title>; other pages are "<Page> · NYU Blockchain Society". */
export const homeTitle = `${siteName} · Official NYU Alumni Club`;
/** Meta descriptions stay under 160 characters: cut at a word boundary with an ellipsis when longer (event pages). */
export const metaDescription = (s: string, max = 159) => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40)).replace(/[\s,.;:·-]+$/, "")}…`;
};

/** Meta, og: and twitter: description, and the JSON-LD description. Keep it under 160 characters. */
export const siteDescription =
  "The official NYU Alumni Club for professionals in blockchain, finance and AI worldwide. Conferences, networking and an accelerator for NYU founders.";

/** Each chain block's page, in block order. */
const conference = { href: "/conference", label: "Conference" };
const networking = { href: "/events", label: "Networking" };
const accelerator = { href: "/accelerator", label: "Accelerator" };
const theChain = { href: "/#chain", label: "The chain" };

/** The top nav (round 15): The chain · Conference · Accelerator, then Join. */
export const navLinks = [theChain, conference, accelerator];
/** The footer keeps every block's page, Networking included. */
export const footerLinks = [theChain, conference, networking, accelerator];

export const links = {
  x: "https://x.com/NYU_Blockchain",
  linkedin: "https://www.linkedin.com/groups/8652445/",
  nyuAlumni:
    "https://www.nyu.edu/alumni/get-involved/alumni-clubs/special-interest-clubs/nyu-blockchain-society.html",
};

export const hero = {
  ledeLead: "The NYU alumni network",
  lede: "for professionals building, investing, and working where the three converge. Each block is one of them.",
};

/** Shown under the hero subtitle. Text only: no NYU logos. */
export const affiliation = {
  label: "Official NYU Alumni Club",
  href: links.nyuAlumni,
};

export const mission = {
  text: "We bring together the institutions, builders, investors, and policymakers shaping what comes next.",
  muted: "Then we help NYU founders build it.",
};

export const chainIntro =
  "Every event, program, and partnership adds a block. Here's what's done, what's next, and what we're building.";

export const joinSection = {
  title: "Add yourself to the network.",
  text: "Pick your blocks, add your name, and you're in. Members hear about events first.",
};

/** Under the final join button. No checkbox. */
export const privacyLine =
  "By joining, organizers may email you about events and programs. Unsubscribe anytime. Only organizers see your details.";

/**
 * The public "<n> blocks on the chain" counter and its breakdowns stay hidden until the network
 * has at least this many members. Below it, nothing but the background's node count is public.
 */
export const chainStatsMinMembers = 50;
