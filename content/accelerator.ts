import type { IndustryId } from "./industries";
import type { FOUNDER_AFFILIATIONS, FOUNDER_NEEDS, FOUNDER_STAGES, SUPPORT_KINDS } from "@/lib/db/schema";

// /accelerator (round 14): the accelerator is "building". Never present it as live, and make no
// promises about funding, equity, cohorts, dates or perks.

export const accelerator = {
  title: "Accelerator",
  /** Block 02's status on the chain. */
  status: "Building",
  intro:
    "Support for NYU founders building across blockchain, finance and AI, being designed with the NYU alumni community. It's still being built: tell us where you fit and we'll be in touch as it takes shape.",
  /** Meta, og: and twitter: description. Under 160 characters, no date. */
  description:
    "NYU Blockchain Society is building support for NYU founders across blockchain, finance and AI. Founders and investors: tell us about you.",
  paths: [
    {
      id: "founder",
      title: "I'm a founder",
      text: "Building a company across blockchain, finance or AI? Tell us what you're working on.",
      cta: "Tell us about your company",
    },
    {
      id: "investor",
      title: "I'm an investor",
      text: "Get a first look at NYU founders building across blockchain, finance and AI. Join our investor list for invites to founder showcases as we launch them.",
      cta: "Join the investor list",
    },
  ],
  /** Below both paths (round 28): partners and sponsors go through the contact form. "Get in touch" links to /contact. */
  partnerLine: { text: "Interested in partnering or sponsoring?", link: "Get in touch." },
} as const;

// The interest forms' options (stored values → labels), shared by the forms, the email and admin.
export const AFFILIATION_LABELS: Record<(typeof FOUNDER_AFFILIATIONS)[number], string> = { alumni: "Alumni", faculty_staff: "Faculty/Staff", student: "Student", other: "Other" };
export const STAGE_LABELS: Record<(typeof FOUNDER_STAGES)[number], string> = { idea: "Idea", building: "Building", launched: "Launched", raised: "Raised" };
/** Legacy supporter rows only (before round 28); the public form no longer offers these. */
export const HELP_LABELS: Record<(typeof SUPPORT_KINDS)[number], string> = { mentor: "Mentor", invest: "Invest", partner: "Partner", other: "Other" };
/** Founders' "What would help most?" (round 28). */
export const NEEDS_LABELS: Record<(typeof FOUNDER_NEEDS)[number], string> = {
  investor_intros: "Investor introductions", office_hours: "Expert office hours", customers: "Customers or pilots", hiring: "Hiring", other: "Other",
};
/** Same ids as the join flow's blocks. */
export const FOCUS = ["blockchain", "finance", "ai"] as const satisfies readonly IndustryId[];
export const FOCUS_LABELS: Record<(typeof FOCUS)[number], string> = { blockchain: "Blockchain", finance: "Finance", ai: "AI" };
