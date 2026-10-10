import { z } from "zod";
import { nyInputToDate } from "./event-time";

// Validation for the /admin/events form. Times arrive as datetime-local values in New York time.

/** Lowercase letters, numbers and dashes, at most 34, so ?src=event-<slug> fits the 40-character source limit. */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,32}[a-z0-9])?$/;
/** Static routes under /events. */
const RESERVED = new Set(["preview"]);

/** "Fall Mixer at KPMG!" → "fall-mixer-at-kpmg". */
export const slugify = (title: string) =>
  title.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 34).replace(/^-+|-+$/g, "");

const text = (max: number, what: string) => z.string().trim().max(max, `Keep the ${what} under ${max} characters.`).transform((v) => v || null);
const when = (what: string) => z.string().trim().transform((v, ctx) => {
  if (!v) return null;
  const d = nyInputToDate(v);
  if (!d) ctx.addIssue({ code: "custom", message: `Check the ${what}.` });
  return d;
});

export const EventInput = z.object({
  title: z.string().trim().min(1, "Add a title.").max(140, "Keep the title under 140 characters."),
  slug: z.string().trim().toLowerCase().max(34, "Keep the link name under 34 characters."),
  startsAt: when("start date and time"),
  endsAt: when("end date and time"),
  venueName: text(140, "venue"),
  address: text(200, "address"),
  description: text(600, "description"),
  registrationUrl: z.string().trim().max(500).transform((v) => v || null)
    .refine((v) => !v || (/^https:\/\//i.test(v) && z.url().safeParse(v).success), "Use a full https:// registration link, e.g. the Luma page."),
  cohost: text(80, "co-host"),
}).transform((d, ctx) => {
  const slug = d.slug || slugify(d.title);
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) ctx.addIssue({ code: "custom", message: "Use a link name of lowercase letters, numbers and dashes (at most 34)." });
  if (!d.startsAt) ctx.addIssue({ code: "custom", message: "Add the start date and time." });
  if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) ctx.addIssue({ code: "custom", message: "The end must be after the start." });
  return { ...d, slug, startsAt: d.startsAt as Date };
});

export type EventFields = z.output<typeof EventInput>;
