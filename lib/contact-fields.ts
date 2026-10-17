// Investor-network fields on contacts (round 28): organizer-only, shown and edited only in /admin,
// never in a public page or any API outside /admin. Shared by the schema, imports, the quick-add
// form, the accelerator forms and the admin pages (no imports, so client components can use it).
// Type and relationship never change invite eligibility (lib/invites.ts doesn't read them).

export const CONTACT_TYPES = ["vc", "angel", "lp", "cvc", "founder", "operator", "other"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];
export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  vc: "VC", angel: "Angel", lp: "LP / family office", cvc: "Corporate VC", founder: "Founder", operator: "Operator", other: "Other",
};

export const INVESTOR_STAGES = ["pre_seed", "seed", "series_a", "multi"] as const;
export type InvestorStage = (typeof INVESTOR_STAGES)[number];
export const INVESTOR_STAGE_LABELS: Record<InvestorStage, string> = { pre_seed: "Pre-seed", seed: "Seed", series_a: "Series A+", multi: "Multi-stage" };

/** In order: a relationship only ever moves forward automatically (imports, forms, quick-add on an existing contact). */
export const RELATIONSHIPS = ["cold", "contacted", "replied", "met", "partner"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];
export const RELATIONSHIP_LABELS: Record<Relationship, string> = { cold: "Cold", contacted: "Contacted", replied: "Replied", met: "Met", partner: "Partner" };
export const laterRelationship = (current: Relationship, next: Relationship | null | undefined): Relationship =>
  next && RELATIONSHIPS.indexOf(next) > RELATIONSHIPS.indexOf(current) ? next : current;

/** The block tags (same ids as the join flow's blocks and the accelerator's focus). */
export const CONTACT_FOCUS = ["blockchain", "finance", "ai"] as const;
export type ContactFocus = (typeof CONTACT_FOCUS)[number];
export const CONTACT_FOCUS_LABELS: Record<ContactFocus, string> = { blockchain: "Blockchain", finance: "Finance", ai: "AI" };

/** NYU alum: yes / no / unknown (null). */
export const nyuAlumLabel = (v: boolean | null) => (v === null ? "Unknown" : v ? "Yes" : "No");

const key = (v: string | undefined | null) => (v ?? "").trim().toLowerCase().replace(/[^a-z0-9+]/g, "");

/**
 * A LinkedIn URL in one form, so the same profile always matches: https://www.linkedin.com/<path>,
 * lowercase, no query, hash or trailing slash. Null for anything that isn't a linkedin.com URL.
 */
export function normalizeLinkedin(v: string | undefined | null): string | null {
  let s = (v ?? "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
  const path = u.pathname.replace(/\/+$/, "").toLowerCase();
  if (!path || path.length > 250) return null;
  return `https://www.linkedin.com${path}`;
}

// Lenient readers for import columns: a label or id in any case; anything unknown is left empty.
const TYPE_WORDS: Record<string, ContactType> = {
  vc: "vc", venturecapital: "vc", venture: "vc", angel: "angel", angelinvestor: "angel",
  lp: "lp", lpfamilyoffice: "lp", familyoffice: "lp", limitedpartner: "lp",
  cvc: "cvc", corporatevc: "cvc", corporateventure: "cvc", corporateventurecapital: "cvc",
  founder: "founder", operator: "operator", other: "other",
};
export const parseContactType = (v: string | undefined) => TYPE_WORDS[key(v)] ?? null;

const STAGE_WORDS: Record<string, InvestorStage> = {
  preseed: "pre_seed", seed: "seed", seriesa: "series_a", seriesa1: "series_a", seriesa2: "series_a", "seriesa+": "series_a", multistage: "multi", multi: "multi",
};
export const parseInvestorStage = (v: string | undefined) => STAGE_WORDS[key(v)] ?? null;

/** "Blockchain, AI" / "ai; finance" → ["blockchain", "ai"] (order of the block tags). */
export function parseFocus(v: string | undefined): ContactFocus[] {
  const words = (v ?? "").toLowerCase().split(/[,;/|&]+|\band\b/).map((w) => w.trim());
  return CONTACT_FOCUS.filter((f) => words.includes(f));
}

export function parseNyuAlum(v: string | undefined): boolean | null {
  const s = key(v);
  if (["yes", "y", "true", "1", "alum", "alumni", "alumnus", "alumna"].includes(s)) return true;
  if (["no", "n", "false", "0"].includes(s)) return false;
  return null;
}

export const parseRelationship = (v: string | undefined) => (RELATIONSHIPS as readonly string[]).includes(key(v)) ? (key(v) as Relationship) : null;
