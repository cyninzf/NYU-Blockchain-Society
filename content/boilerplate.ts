// Ready-to-paste descriptions for press, partners and event listings, drafted from the
// mission copy. Set `status` to "approved" once the maintainer has reviewed them: the media
// kit shows a "Draft, pending review" tag until then.

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
    text: "NYU Blockchain Society is the professional network for NYU alumni at the intersection of blockchain, finance, and AI. An official NYU Alumni club, it brings together the institutions, builders, investors, and policymakers shaping what comes next, connects alumni and industry professionals across New York, and helps NYU founders build.",
  },
  {
    id: "long",
    label: "Long (~100 words)",
    text: "NYU Blockchain Society is the professional network for NYU alumni at the intersection of blockchain, finance, and AI. An official NYU Alumni club, it brings together the institutions, builders, investors, and policymakers shaping what comes next, connects alumni and industry professionals across New York, and helps NYU founders build. Since 2024 it has hosted the annual NYU Blockchain Conference at New York University; the 2024 edition drew 632 registrations, with 35 speakers and moderators across 7 panels plus a fireside. The society also runs Networking events for alumni in New York, from mixers to roundtables, and is building an accelerator for NYU founders.",
  },
];

export const wordCount = (s: string) => s.trim().split(/\s+/).length;
