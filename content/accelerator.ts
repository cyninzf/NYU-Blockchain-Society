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
