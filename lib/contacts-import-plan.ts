import "server-only";
// The contacts import as a plan (round 25): the preview runs it as a dry run (counts, each row's
// source and every skipped row with its reason) and the import runs the same plan, then applies it.
// Rows become contacts only: no members, no emails. Matches only fill empty fields; notes and
// "Also from <source>" are appended as dated lines, never replacing anything.

import { and, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "./db";
import { contacts } from "./db/schema";
import {
  clean, EMAIL_RE, maskEmail, MAX_NOTE, nameHeadlineKey, newNoteLines, parseCheckIn, slugifySource,
  type ImportCounts, type ImportFormat, type Mapping, type PlanRow, type SkipReason,
} from "./contacts-import";

type Candidate = typeof contacts.$inferInsert;
type Fill = { id: number; set: Partial<Pick<Candidate, "name" | "headline" | "company" | "checkedIn">>; notes: string | null };

export type ImportPlan = {
  counts: ImportCounts;
  rows: PlanRow[];
  /** New or matched rows with no source of their own while the import has no label: the import refuses until one is set. */
  missingSource: number;
  inserts: Candidate[];
  fills: Fill[];
};

const isEmail = (v: string) => v.length <= 254 && EMAIL_RE.test(v) && z.email().safeParse(v).success;

/**
 * Reads every row with the confirmed mapping and looks up existing contacts, without writing.
 * `label` is the import's source label (may be empty when every row has its own source).
 * Rows without an email are only taken from a LinkedIn group export (name + headline, as before);
 * in any other list they're skipped as "Missing email".
 */
export async function planImport(db: Db, data: string[][], m: Mapping, label: string, format: ImportFormat, date?: string): Promise<ImportPlan> {
  const counts: ImportCounts = { total: data.length, created: 0, matched: 0, updated: 0, skipped: 0, bySource: {} };
  const rows: PlanRow[] = [];
  type Row = Candidate & { plan: PlanRow; note: string; key: string };
  const keep: Row[] = [];
  const seen = new Set<string>();
  data.forEach((r, i) => {
    const cell = (c: number, max: number) => (c >= 0 ? clean(r[c], max) : "");
    const name = cell(m.name, 120), email = cell(m.email, 300);
    const source = (m.source >= 0 ? slugifySource(r[m.source]) : "") || label;
    const plan: PlanRow = { line: i + 1, name, email: email ? maskEmail(email) : "", source, action: "skip", headline: cell(m.headline, 500), company: cell(m.company, 200) };
    rows.push(plan);
    const skip = (reason: SkipReason) => { plan.reason = reason; counts.skipped++; };
    let key: string;
    if (email) {
      if (!isEmail(email)) return skip("Invalid email");
      key = `e:${email.toLowerCase()}`;
    } else if (format === "linkedin") {
      if (!name) return skip("No name or email");
      key = `n:${nameHeadlineKey(name, plan.headline || null)}`;
    } else return skip("Missing email");
    if (seen.has(key)) return skip("Duplicate in file");
    seen.add(key);
    keep.push({
      plan, key, note: cell(m.notes, MAX_NOTE), source,
      name: name || null, email: email || null, headline: plan.headline || null, company: plan.company || null,
      checkedIn: m.checkIn >= 0 ? parseCheckIn(r[m.checkIn]) : null,
    });
  });

  // Existing contacts for these rows: by lower(email); email-less ones by name + headline.
  type Existing = Pick<typeof contacts.$inferSelect, "id" | "name" | "headline" | "company" | "checkedIn" | "source" | "notes">;
  const existing = new Map<string, Existing>();
  const cols = { id: contacts.id, name: contacts.name, headline: contacts.headline, company: contacts.company, checkedIn: contacts.checkedIn, source: contacts.source, notes: contacts.notes };
  const emails = keep.filter((r) => r.email).map((r) => r.email!.toLowerCase());
  for (let i = 0; i < emails.length; i += 500) {
    const found = await db.select({ ...cols, k: sql<string>`lower(${contacts.email})` }).from(contacts).where(inArray(sql`lower(${contacts.email})`, emails.slice(i, i + 500)));
    for (const f of found) existing.set(`e:${f.k}`, f);
  }
  const names = [...new Set(keep.filter((r) => !r.email).map((r) => r.name!.toLowerCase()))];
  for (let i = 0; i < names.length; i += 500) {
    const found = await db.select(cols).from(contacts).where(and(isNull(contacts.email), inArray(sql`lower(${contacts.name})`, names.slice(i, i + 500))));
    for (const f of found) existing.set(`n:${nameHeadlineKey(f.name ?? "", f.headline)}`, f);
  }

  const inserts: Candidate[] = [], fills: Fill[] = [];
  let missingSource = 0;
  for (const r of keep) {
    const { plan, note, key, ...row } = r;
    if (!plan.source) missingSource++;
    counts.bySource[plan.source] = (counts.bySource[plan.source] ?? 0) + 1;
    const e = existing.get(key);
    if (!e) {
      plan.action = "new";
      counts.created++;
      inserts.push({ ...row, notes: newNoteLines(null, [note], date) });
      continue;
    }
    plan.action = "match";
    counts.matched++;
    const set: Fill["set"] = {};
    for (const k of ["name", "headline", "company"] as const) if (!e[k]?.trim() && row[k]) set[k] = row[k];
    if (e.checkedIn === null && row.checkedIn !== null) set.checkedIn = row.checkedIn;
    // The contact keeps its first source; a different one is noted.
    const notes = newNoteLines(e.notes, [note, plan.source && plan.source !== e.source ? `Also from ${plan.source}` : ""], date);
    if (Object.keys(set).length || notes) { counts.updated++; fills.push({ id: e.id, set, notes }); }
  }
  return { counts, rows, missingSource, inserts, fills };
}

/**
 * Writes a plan. Inserts skip anything a concurrent import added meanwhile; fills write each
 * field only while it's still empty and append notes in SQL, so nothing filled is ever overwritten.
 * Returns how many contacts were really created.
 */
export async function applyImport(db: Db, plan: ImportPlan) {
  let created = 0;
  for (let i = 0; i < plan.inserts.length; i += 500) {
    created += (await db.insert(contacts).values(plan.inserts.slice(i, i + 500)).onConflictDoNothing().returning({ id: contacts.id })).length;
  }
  const updates = plan.fills.map(({ id, set, notes }) => {
    const v: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(set) as [keyof Fill["set"], unknown][]) {
      const c = contacts[k];
      v[k] = k === "checkedIn" ? sql`coalesce(${c}, ${val})` : sql`coalesce(nullif(trim(${c}), ''), ${val})`;
    }
    if (notes) v.notes = sql`case when coalesce(trim(${contacts.notes}), '') = '' then ${notes} else ${contacts.notes} || E'\\n' || ${notes} end`;
    return db.update(contacts).set(v).where(sql`${contacts.id} = ${id}`);
  });
  for (let i = 0; i < updates.length; i += 100) {
    const chunk = updates.slice(i, i + 100);
    if (chunk.length) await db.batch(chunk as [typeof chunk[0], ...typeof chunk]);
  }
  return created;
}
