// Shared by the import server actions and the admin import screen (no server-only imports).
// One import for every list: a registrant export with emails (e.g. Luma) or the LinkedIn group
// export (Name, Title / Headline, Group role; no emails). Only name, email, headline (or title),
// company, check-in, source, notes and the investor-network fields (round 28: type, focus, stage,
// LinkedIn URL, NYU alum, relationship) are ever stored; "Group role" and "Open to work" can't even be mapped.

export const SOURCE_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAPPING_KEYS = ["name", "email", "headline", "company", "checkIn", "source", "notes", "contactType", "focus", "stage", "linkedin", "nyuAlum", "relationship"] as const;
export type Mapping = Record<(typeof MAPPING_KEYS)[number], number>; // -1 = not mapped
export const NO_MAPPING = Object.fromEntries(MAPPING_KEYS.map((k) => [k, -1])) as Mapping;
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

/**
 * Best guess at which columns hold each field. Source, notes and the investor-network fields only on
 * an exact header, so a "utm_source" is never read as one.
 */
export function guessMapping(headers: string[]): Mapping {
  const h = headers.map((x) => (isIgnoredColumn(x) ? "" : x.trim().toLowerCase()));
  const find = (...res: RegExp[]) => { for (const re of res) { const i = h.findIndex((x) => re.test(x)); if (i >= 0) return i; } return -1; };
  return {
    name: find(/^(full[ _-]?)?name$/, /name/),
    email: find(/^e-?mail$/, /e-?mail/),
    headline: find(/headline/, /^(job )?title$/),
    company: find(/^company( name)?$/, /^(organi[sz]ation|employer)$/),
    checkIn: find(/check/, /attend/),
    source: find(/^(contact )?source$/),
    notes: find(/^notes?$/),
    contactType: find(/^(contact |investor )?type$/),
    focus: find(/^focus( areas?)?$/),
    stage: find(/^(investment |investor )?stage$/),
    linkedin: find(/^linkedin( profile)?( url)?$/),
    nyuAlum: find(/^nyu alum(ni|nus|na)?$/),
    relationship: find(/^relationship( status)?$/),
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

/**
 * A row's own source as a source label: "via Alex Example" → "via-alex-example". Lowercase letters, numbers and
 * dashes, at most 40 (SOURCE_RE), so invites, the invite link's src and the filter keep working.
 * Empty (or nothing usable) → "", and the import's label applies.
 */
export function slugifySource(v: string | undefined) {
  return (v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").slice(0, 40).replace(/-+$/, "");
}

/** Personal introductions (round 26): a source starting "via-" (an import row's "via Alex" → via-alex). Never invited in bulk unless chosen explicitly. */
export const PERSONAL_PREFIX = "via-";
export const isPersonalSource = (source: string) => source.startsWith(PERSONAL_PREFIX);
/** Shown, and confirmed, before a personal-introductions source can be invited. */
export const PERSONAL_WARNING = "These are personal introductions. They'll get the standard society invite.";

/**
 * Form submissions (round 28.1): people who wrote to us through the accelerator forms. Never
 * invited in bulk unless chosen explicitly, exactly like personal introductions.
 */
export const FORM_SOURCES = ["accelerator-form", "investor-list"] as const;
export const isFormSource = (source: string) => (FORM_SOURCES as readonly string[]).includes(source);
export const FORM_WARNING = "These people wrote to us through a form on the site. They'll get the standard society invite.";

/** Sources never in a bulk invite unless a super admin picks that exact source, ticks it and confirms: "personal" (via-) or "form". */
export type ProtectedKind = "personal" | "form";
export const protectedKind = (source: string): ProtectedKind | null => (isPersonalSource(source) ? "personal" : isFormSource(source) ? "form" : null);
export const isProtectedSource = (source: string) => protectedKind(source) !== null;
export const PROTECTED_WARNING: Record<ProtectedKind, string> = { personal: PERSONAL_WARNING, form: FORM_WARNING };
/** The tick box's label, per kind. */
export const PROTECTED_TICK: Record<ProtectedKind, string> = { personal: "Include these personal introductions", form: "Include these form submissions" };

/** Today's date in New York, for note stamps: "2026-10-16". */
export const noteDate = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });

export const MAX_NOTE = 1000;

/**
 * The dated lines to append to a contact's notes ("2026-10-16: …"), never replacing what's there.
 * A text already in the notes (the same file imported twice) isn't added again. Null when there's nothing new.
 */
export function newNoteLines(existing: string | null, texts: string[], date = noteDate()): string | null {
  const have = (existing ?? "").split("\n").map((l) => l.replace(/^\d{4}-\d{2}-\d{2}: /, "").trim());
  const add = [...new Set(texts.map((t) => t.trim()).filter(Boolean))].filter((t) => !have.includes(t));
  return add.length ? add.map((t) => `${date}: ${t}`).join("\n") : null;
}

export type SkipReason = "Missing email" | "Invalid email" | "Duplicate in file" | "No name or email";

/** What an import will do (the dry run) or did. Shared by the preview and the summary. */
export type ImportCounts = {
  total: number;
  /** New contacts. */
  created: number;
  /** Rows that match an existing contact (email, case-insensitive and trimmed; LinkedIn rows: name + headline). */
  matched: number;
  /** Matched contacts that gain something: an empty field filled, a note or an "Also from" line. */
  updated: number;
  skipped: number;
  /** New and matched rows per source. */
  bySource: Record<string, number>;
};

/** One row of the preview: its line in the file, what happens to it and with which source. Emails masked. */
export type PlanRow = { line: number; name: string; email: string; headline: string; company: string; source: string; action: "new" | "match" | "skip"; reason?: SkipReason };

export type ImportSummary = ImportCounts & {
  /** Linked to members right after the import (lib/contact-links.ts), across all contacts. */
  linkedByEmail: number;
  linkedByName: number;
  /** Contacts with an unclear name match, listed under "Needs a look". */
  needsLook: number;
};
