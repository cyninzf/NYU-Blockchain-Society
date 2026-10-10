// Shared by the import server actions and the admin import screen (no server-only imports).
// One import for every list: a registrant export with emails (e.g. Luma) or the LinkedIn group
// export (Name, Title / Headline, Group role; no emails). Only name, email, headline and check-in
// are ever stored; "Group role" and "Open to work" can't even be mapped.

export const SOURCE_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Mapping = { name: number; email: number; headline: number; checkIn: number }; // -1 = not mapped
export type ImportFormat = "linkedin" | "list";

/** "jane@example.com" → "j***@e***.com". */
export function maskEmail(v: string) {
  const [local, domain = ""] = v.trim().split("@");
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain, tld = dot > 0 ? domain.slice(dot) : "";
  return `${local.slice(0, 1)}***@${host.slice(0, 1)}***${tld}`;
}

/** A mapped check-in column: blank or a "no" word means not checked in; anything else (yes, a timestamp) means checked in. */
export const parseCheckIn = (v: string | undefined) => {
  const s = (v ?? "").trim().toLowerCase();
  return s !== "" && !["false", "no", "n", "0", "not checked in", "-"].includes(s);
};

const norm = (h: string) => h.trim().toLowerCase().replace(/[^a-z]/g, "");

/** Columns that are never read, previewed or stored, whatever the mapping says. */
export const isIgnoredColumn = (header: string) => ["grouprole", "opentowork"].includes(norm(header));

/** Best guess at which columns hold the name, email, headline and check-in. */
export function guessMapping(headers: string[]): Mapping {
  const h = headers.map((x) => (isIgnoredColumn(x) ? "" : x.trim().toLowerCase()));
  const find = (...res: RegExp[]) => { for (const re of res) { const i = h.findIndex((x) => re.test(x)); if (i >= 0) return i; } return -1; };
  return {
    name: find(/^(full[ _-]?)?name$/, /name/),
    email: find(/^e-?mail$/, /e-?mail/),
    headline: find(/headline/, /^(job )?title$/),
    checkIn: find(/check/, /attend/),
  };
}

/** The header row: the first of the first 10 rows with a name or email column (exports can start with a note). */
export function headerRowIndex(rows: string[][]) {
  const i = rows.slice(0, 10).findIndex((r) => { const m = guessMapping(r); return m.name >= 0 || m.email >= 0; });
  return Math.max(i, 0);
}

/** The LinkedIn group export: a headline or group-role column and no email column. */
export function formatOf(headers: string[]): ImportFormat {
  const m = guessMapping(headers);
  return m.email < 0 && (m.headline >= 0 || headers.some((x) => norm(x) === "grouprole")) ? "linkedin" : "list";
}

/** Default source label for a LinkedIn export: this month, e.g. linkedin-2026-10. */
export const linkedinSource = () => `linkedin-${new Date().toISOString().slice(0, 7)}`;

/** Collapsed whitespace, for names and headlines. */
export const clean = (v: string | undefined, max: number) => (v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Dedupe key for rows without an email, matching the unique index on (lower(name), lower(headline)). */
export const nameHeadlineKey = (name: string, headline: string | null) => `${name.toLowerCase()}\u0000${(headline ?? "").toLowerCase()}`;

export type ImportSummary = {
  total: number;
  imported: number;
  /** Already in contacts (or twice in the file). */
  duplicates: number;
  /** No name and no email. */
  skipped: number;
  /** An email cell that isn't an email address. */
  invalid: number;
  /** Linked to members right after the import (lib/contact-links.ts), across all contacts. */
  linkedByEmail: number;
  linkedByName: number;
  /** Contacts with an unclear name match, listed under "Needs a look". */
  needsLook: number;
};
