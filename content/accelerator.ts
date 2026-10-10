import type { IndustryId } from "./industries";
import type { FOUNDER_AFFILIATIONS, FOUNDER_STAGES, SUPPORT_KINDS } from "@/lib/db/schema";

// /accelerator (round 14): the accelerator is "building". Never present it as live, and make no
// promises about funding, equity, cohorts, dates or perks.

export const accelerator = {
  title: "Accelerator",
  /** Block 02's status on the chain. */
  status: "Building",
  intro:
    "Support for NYU founders working across digital assets and AI, being designed with the NYU alumni community. It's still being built: tell us where you fit and we'll be in touch as it takes shape.",
  /** Meta, og: and twitter: description. Under 160 characters, no date. */
  description:
    "NYU Blockchain Society is building support for NYU founders across digital assets and AI. Founders, mentors, investors and partners: tell us about you.",
  paths: [
    {
      id: "founder",
      title: "I'm a founder",
      text: "Building a company across blockchain, finance or AI? Tell us what you're working on.",
      cta: "Tell us about your company",
    },
    {
      id: "supporter",
      title: "I want to mentor, invest or partner",
      text: "Alumni and industry professionals who'd like to help NYU founders build.",
      cta: "Tell us how you'd help",
    },
  ],
} as const;

// The interest forms' options (stored values → labels), shared by the forms, the email and admin.
export const AFFILIATION_LABELS: Record<(typeof FOUNDER_AFFILIATIONS)[number], string> = { alumni: "Alumni", faculty_staff: "Faculty/Staff", student: "Student", other: "Other" };
export const STAGE_LABELS: Record<(typeof FOUNDER_STAGES)[number], string> = { idea: "Idea", building: "Building", launched: "Launched", raised: "Raised" };
export const HELP_LABELS: Record<(typeof SUPPORT_KINDS)[number], string> = { mentor: "Mentor", invest: "Invest", partner: "Partner", other: "Other" };
/** Same ids as the join flow's blocks. */
export const FOCUS = ["blockchain", "finance", "ai"] as const satisfies readonly IndustryId[];
export const FOCUS_LABELS: Record<(typeof FOCUS)[number], string> = { blockchain: "Blockchain", finance: "Finance", ai: "AI" };
