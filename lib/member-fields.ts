import { z } from "zod";
import { cleanLocation } from "./location";

// Validation for the optional member fields, shared by the join flow ("Strengthen your block"),
// the admin Edit form and the member's own "Update your block" page.

/** Trimmed text up to `max` characters; empty means "not given" (null). */
export const optText = (max: number) => z.string().trim().max(max).transform((v) => v || null);

export const linkedinUrl = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
  .refine((v) => !v || /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/.+/i.test(v), "Use a linkedin.com profile URL.")
  .transform((v) => v || null);

export const gradYear = z.union([z.literal(""), z.coerce.number().int().min(1940, "Use a 4-digit grad year.").max(new Date().getFullYear() + 8, "Use a 4-digit grad year.")])
  .transform((v) => (v === "" ? null : v));

/** "City and country", tidied (lib/location.ts). */
export const location = z.string().max(200).transform((v) => cleanLocation(v) || null);
