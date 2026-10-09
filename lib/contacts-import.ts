// Shared by the import server actions and the admin import screen (no server-only imports).

export const SOURCE_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Mapping = { name: number; email: number; checkIn: number }; // -1 = not mapped

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

/** Best guess at which columns hold the name, email and check-in. */
export function guessMapping(headers: string[]): Mapping {
  const h = headers.map((x) => x.trim().toLowerCase());
  const find = (...res: RegExp[]) => { for (const re of res) { const i = h.findIndex((x) => re.test(x)); if (i >= 0) return i; } return -1; };
  return {
    name: find(/^(full[ _-]?)?name$/, /name/),
    email: find(/^e-?mail$/, /e-?mail/),
    checkIn: find(/check/, /attend/),
  };
}

export type ImportSummary = { total: number; imported: number; duplicates: number; invalid: number; alreadyMembers: number };
