// "City and country" is free text. For the admin's "Members by country" counts and filter, the
// country is read from the last comma-separated part ("Lisbon, Portugal" → Portugal) and
// normalized a little, so "USA", "US" and "Brooklyn, NY" all count as United States. Rough on
// purpose: the raw text is always kept and shown as entered.

const US_STATES =
  "AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware|DC District of Columbia|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming";

const ALIASES = new Map<string, string>([
  ...["us", "usa", "u.s.", "u.s.a.", "united states", "united states of america", "america"].map((a) => [a, "United States"] as const),
  ...["uk", "u.k.", "united kingdom", "great britain", "england", "scotland", "wales"].map((a) => [a, "United Kingdom"] as const),
  ...["uae", "u.a.e.", "united arab emirates"].map((a) => [a, "United Arab Emirates"] as const),
  // "Brooklyn, NY" or "Austin, Texas" (not "Georgia" spelled out: that's also a country)
  ...US_STATES.split("|").flatMap((s) => [s.slice(0, 2).toLowerCase(), s.slice(3).toLowerCase()]).filter((a) => a !== "georgia").map((a) => [a, "United States"] as const),
]);

/** " Lisbon ,  Portugal " → "Lisbon, Portugal": trimmed (stray commas too), single spaces, at most 120 characters. */
export const cleanLocation = (v: string) => v.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").replace(/^[\s,]+|[\s,]+$/g, "").slice(0, 120);

/** The country part of a "City and country" entry, or null when there's nothing to go on. */
export function countryOf(location: string | null | undefined): string | null {
  const last = (location ?? "").split(",").map((p) => p.trim()).filter(Boolean).pop();
  if (!last) return null;
  const k = last.toLowerCase().replace(/\s+/g, " ");
  if (ALIASES.has(k)) return ALIASES.get(k)!;
  // Title case so "portugal" and "Portugal" count together (short all-caps codes stay as typed).
  return /^[A-Z.]{2,4}$/.test(last) ? last : last.replace(/\p{L}+/gu, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}
