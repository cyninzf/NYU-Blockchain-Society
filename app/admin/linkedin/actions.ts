"use server";

// LinkedIn group roster import. The file travels in the request body, is parsed in memory and
// dropped: it's never written to disk, logged or stored anywhere except as the resulting rows,
// and only the name, headline and group role columns are read.

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { SOURCE_RE } from "@/lib/contacts-import";
import { parseCsv } from "@/lib/csv";
import { linkedinGroupMembers as roster, members } from "@/lib/db/schema";
import { headerRowIndex, ROSTER_MAX_BYTES, rosterColumns, rosterKey, rosterRow, type RosterRow, type RosterSummary } from "@/lib/linkedin-import";
import { readXlsx } from "@/lib/xlsx";

export type RosterPreview = { ok: true; rows: number; sample: RosterRow[]; ignored: number } | { ok: false; error: string };
export type RosterImport = ({ ok: true } & RosterSummary) | { ok: false; error: string };

async function readRoster(fd: FormData): Promise<{ rows: RosterRow[]; ignored: number } | string> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return "Choose an .xlsx or .csv file.";
  if (file.size > ROSTER_MAX_BYTES) return "That file is over 4 MB.";
  const xlsx = /\.xlsx$/i.test(file.name), csv = /\.csv$/i.test(file.name);
  if (!xlsx && !csv) return "Upload the group export as .xlsx or .csv.";
  let table: string[][];
  try {
    table = xlsx ? readXlsx(Buffer.from(await file.arrayBuffer())) : parseCsv(await file.text());
  } catch {
    return "Couldn't read that file. Upload the export as it was downloaded (.xlsx) or saved as .csv.";
  }
  const h = headerRowIndex(table);
  if (h < 0) return "No \"Name\" column found. Expected columns: Name, Title / Headline, Group role.";
  const cols = rosterColumns(table[h]);
  const ignored = table[h].filter((_, i) => i !== cols.name && i !== cols.headline && i !== cols.role).length;
  return { rows: table.slice(h + 1).map((r) => rosterRow(r, cols)), ignored };
}

/** Step 1: the first 5 rows as they'll be stored (name, headline, role only). */
export async function previewRoster(fd: FormData): Promise<RosterPreview> {
  await requireAdmin();
  const r = await readRoster(fd);
  if (typeof r === "string") return { ok: false, error: r };
  if (!r.rows.length) return { ok: false, error: "That file has no rows under the header." };
  return { ok: true, rows: r.rows.length, sample: r.rows.slice(0, 5), ignored: r.ignored };
}

/** Step 2: add people not on the roster yet. Existing rows are never touched. */
export async function importRoster(fd: FormData): Promise<RosterImport> {
  const db = await requireAdmin();
  const source = String(fd.get("source") ?? "").trim().toLowerCase();
  if (!SOURCE_RE.test(source)) return { ok: false, error: "Use a short source label: lowercase letters, numbers and dashes, like linkedin-group-2026-10." };
  const r = await readRoster(fd);
  if (typeof r === "string") return { ok: false, error: r };

  const s: RosterSummary = { total: r.rows.length, imported: 0, duplicates: 0, skipped: 0 };
  const seen = new Set<string>();
  const fresh: (typeof roster.$inferInsert)[] = [];
  for (const row of r.rows) {
    if (!row.name) { s.skipped++; continue; }
    const k = rosterKey(row);
    if (seen.has(k)) { s.duplicates++; continue; }
    seen.add(k);
    fresh.push({ name: row.name, headline: row.headline, groupRole: row.role, source });
  }
  try {
    for (let i = 0; i < fresh.length; i += 500) {
      const chunk = fresh.slice(i, i + 500);
      // Already on the roster (same name and headline, any case): skipped, never overwritten.
      const inserted = await db.insert(roster).values(chunk).onConflictDoNothing().returning({ id: roster.id });
      s.imported += inserted.length;
      s.duplicates += chunk.length - inserted.length;
    }
  } catch (e) {
    console.error("roster import failed", e instanceof Error ? e.message : e);
    return { ok: false, error: `The import stopped after ${s.imported} rows because of a database error. Re-run it: rows already imported are skipped.` };
  }
  refresh();
  return { ok: true, ...s };
}

const intOf = (v: FormDataEntryValue | null) => { const n = Number(String(v ?? "").trim().replace(/^#/, "")); return Number.isInteger(n) && n > 0 ? n : 0; };

/** Manual only: an admin links a roster row to a member (by block number). Never automatic. */
export async function linkRosterMember(fd: FormData) {
  const db = await requireAdmin();
  const id = intOf(fd.get("id")), memberId = intOf(fd.get("memberId"));
  if (!id || !memberId) throw new Error("Enter a block number.");
  const [m] = await db.select({ id: members.id }).from(members).where(eq(members.id, memberId));
  if (!m) throw new Error(`No member #${memberId}.`);
  await db.update(roster).set({ memberId }).where(eq(roster.id, id));
  refresh();
}

export async function unlinkRosterMember(fd: FormData) {
  const db = await requireAdmin();
  const id = intOf(fd.get("id"));
  if (!id) throw new Error("Bad request");
  await db.update(roster).set({ memberId: null }).where(eq(roster.id, id));
  refresh();
}

/** For removal requests. Permanent. */
export async function deleteRosterRow(fd: FormData) {
  const db = await requireAdmin();
  const id = intOf(fd.get("id"));
  if (!id || fd.get("confirm") !== "yes") throw new Error("Bad request");
  await db.delete(roster).where(eq(roster.id, id));
  refresh();
}
