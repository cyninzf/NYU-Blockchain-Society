// Ready-to-paste descriptions for press, partners and event listings, drafted from the
// mission copy. Set `boilerplateStatus` to "approved" once the maintainer has reviewed them:
// until then they're hidden on the public media kit and shown, tagged as a draft, only to
// admins at /admin/media-kit-preview.

export const boilerplateStatus: "draft" | "approved" = "draft";

export const boilerplate = [
  {
    id: "one-liner",
    label: "One-liner",
    text: "NYU Blockchain Society is the professional network for NYU alumni at the intersection of blockchain, finance, and AI.",
  },
  {
    id: "short",
    label: "Short (~50 words)",
    text: "NYU Blockchain Society is the professional network for NYU alumni at the intersection of blockchain, finance, and AI. An official NYU Alumni club, it brings together the institutions, builders, investors, and policymakers shaping what comes next, connects NYU alumni and industry professionals worldwide, and helps NYU founders build.",
  },
  {
    id: "long",
    label: "Long (~100 words)",
    text: "NYU Blockchain Society is the professional network for NYU alumni at the intersection of blockchain, finance, and AI. An official NYU Alumni club, it brings together the institutions, builders, investors, and policymakers shaping what comes next, connects NYU alumni and industry professionals worldwide, and helps NYU founders build. It launched the annual NYU Blockchain Conference on November 1, 2024 at New York University; the first edition drew 632 registrations, with 35 speakers and moderators across 7 panels plus a fireside. The society also runs networking events for alumni, from mixers to roundtables, and is building an accelerator for NYU founders.",
  },
];

export const wordCount = (s: string) => s.trim().split(/\s+/).length;
