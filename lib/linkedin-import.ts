// LinkedIn group roster: shared by the import actions, the import screen and the roster page
// (no server-only imports). Only three columns are ever read: "Name", "Title / Headline" and
// "Group role". Everything else in the export, including "Open to work", is ignored.

export const ROSTER_MAX_BYTES = 4 * 1024 * 1024;
export const GROUP_ROLES = ["owner", "manager"] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

export type RosterColumns = { name: number; headline: number; role: number }; // -1 = missing
export type RosterRow = { name: string; headline: string; role: GroupRole | null };
export type RosterSummary = { total: number; imported: number; duplicates: number; skipped: number };

const norm = (h: string) => h.trim().toLowerCase().replace(/[^a-z]/g, "");

/** Where the three expected columns are, by header name. */
export function rosterColumns(headers: string[]): RosterColumns {
  const h = headers.map(norm);
  const find = (...names: string[]) => { for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; } return -1; };
  return { name: find("name", "fullname"), headline: find("titleheadline", "headline", "title"), role: find("grouprole", "role") };
}

/** The header row: the first of the first 10 rows that has a "Name" column. */
export const headerRowIndex = (rows: string[][]) => rows.slice(0, 10).findIndex((r) => rosterColumns(r).name >= 0);

/** "Owner (You)" / "Owner" → owner, "Manager" → manager, anything else (Member, blank) → null. */
export function parseGroupRole(v: string | undefined): GroupRole | null {
  const s = (v ?? "").trim().toLowerCase();
  if (s.startsWith("owner")) return "owner";
  if (s.startsWith("manager") || s.startsWith("admin")) return "manager";
  return null;
}

export function rosterRow(r: string[], c: RosterColumns): RosterRow {
  const cell = (i: number) => (i >= 0 ? (r[i] ?? "").replace(/\s+/g, " ").trim() : "");
  return { name: cell(c.name).slice(0, 200), headline: cell(c.headline).slice(0, 500), role: parseGroupRole(cell(c.role)) };
}

/** Dedupe key, matching the unique index on (lower(name), lower(headline)). */
export const rosterKey = (r: { name: string; headline: string }) => `${r.name.toLowerCase()}\u0000${r.headline.toLowerCase()}`;

/**
 * Rough field buckets from headlines, for aggregate counts only: never stored, exported or
 * shown per person. A headline can land in several buckets; "other" means none matched.
 */
export const FIELD_BUCKETS = [
  { id: "blockchain", label: "Blockchain / crypto", re: /\b(blockchain|crypto\w*|web3|defi|digital assets?|tokeni[sz]\w*|on-?chain|stablecoins?|nfts?|dao|smart contracts?|distributed ledger)\b/i },
  { id: "finance", label: "Finance", re: /\b(financ\w*|fintech|bank\w*|invest\w*|capital|trad(ing|er)|asset management|wealth|private equity|venture|vc|hedge|portfolio|payments?|cfa|equit(y|ies)|credit|markets?|treasury|fund)\b/i },
  { id: "ai", label: "AI", re: /\b(ai|a\.i\.|artificial intelligence|machine learning|ml|llms?|deep learning|data scien\w*|genai|generative|nlp|computer vision)\b/i },
  { id: "student", label: "Student", re: /\b(students?|candidate|undergrad\w*|phd|mba|class of|incoming)\b/i },
] as const;

export function fieldBuckets(headlines: string[]) {
  const counts: Record<string, number> = Object.fromEntries([...FIELD_BUCKETS.map((b) => [b.id, 0]), ["other", 0]]);
  for (const h of headlines) {
    let hit = false;
    for (const b of FIELD_BUCKETS) if (b.re.test(h)) { counts[b.id]++; hit = true; }
    if (!hit) counts.other++;
  }
  return [...FIELD_BUCKETS.map((b) => ({ id: b.id, label: b.label, n: counts[b.id] })), { id: "other", label: "Other", n: counts.other }];
}

/** Name tokens for matching: no accents, credentials ("Jane Doe, CFA"), brackets or punctuation. */
export function nameTokens(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\(.*?\)/g, " ").split(",")[0].replace(/[^a-z\s'-]/g, " ").split(/\s+/).filter(Boolean);
}

/** How likely two names are the same person: 3 same name, 2 same first and last, 1 same last and first initial, 0 no. */
export function nameScore(a: string, b: string) {
  const x = nameTokens(a), y = nameTokens(b);
  if (!x.length || !y.length) return 0;
  if (x.join(" ") === y.join(" ")) return 3;
  const [xf, xl] = [x[0], x[x.length - 1]], [yf, yl] = [y[0], y[y.length - 1]];
  if (x.length > 1 && y.length > 1 && xl === yl) return xf === yf ? 2 : xf[0] === yf[0] ? 1 : 0;
  return 0;
}
