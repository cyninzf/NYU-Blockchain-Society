import "server-only";
// The contacts import as a plan (round 25): the preview runs it as a dry run (counts, each row's
// source and every skipped row with its reason) and the import runs the same plan, then applies it.
// Rows become contacts only: no members, no emails. Matches only fill empty fields; notes and
// "Also from <source>" are appended as dated lines, never replacing anything. Round 28: the
// investor-network fields follow the same rule (a relationship only moves forward), and a new
// organizer note sets the contact's last touch. `planFill` and `fillQuery` are shared with
// quick-add and the accelerator forms (lib/contact-save.ts).

import { and, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "./db";
import { contacts } from "./db/schema";
import {
  clean, EMAIL_RE, maskEmail, MAX_NOTE, nameHeadlineKey, newNoteLines, noteDate, parseCheckIn, slugifySource,
  type ImportCounts, type ImportFormat, type Mapping, type PlanRow, type SkipReason,
} from "./contacts-import";
import { laterRelationship, normalizeLinkedin, parseContactType, parseFocus, parseInvestorStage, parseNyuAlum, parseRelationship, RELATIONSHIPS } from "./contact-fields";

export type Candidate = typeof contacts.$inferInsert;
const TEXT_FIELDS = ["name", "headline", "company", "contactType", "stage", "linkedinUrl"] as const;
const BOOL_FIELDS = ["checkedIn", "nyuAlum"] as const;
type FillSet = Partial<Pick<Candidate, (typeof TEXT_FIELDS)[number] | (typeof BOOL_FIELDS)[number] | "focus" | "relationship">>;
/** What a match gains: fields that are empty now, notes to append, and the date of a new organizer note (its last touch). */
export type Fill = { id: number; set: FillSet; notes: string | null; touch: string | null };
export type Existing = Pick<typeof contacts.$inferSelect, "id" | "email" | "name" | "headline" | "company" | "checkedIn" | "source" | "notes" | "contactType" | "stage" | "linkedinUrl" | "nyuAlum" | "focus" | "relationship">;
export const existingCols = {
  id: contacts.id, email: contacts.email, name: contacts.name, headline: contacts.headline, company: contacts.company, checkedIn: contacts.checkedIn, source: contacts.source, notes: contacts.notes,
  contactType: contacts.contactType, stage: contacts.stage, linkedinUrl: contacts.linkedinUrl, nyuAlum: contacts.nyuAlum, focus: contacts.focus, relationship: contacts.relationship,
};

/**
 * What a row adds to an existing contact: each field only while it's empty (focus while it has no
 * tags; a relationship only if it's further along), the note and "Also from <source>" as dated lines
 * (never repeated), and the last touch when the organizer note is new. Null when nothing changes.
 */
export function planFill(e: Existing, row: Candidate, note: string, date = noteDate()): Fill | null {
  const set: FillSet = {};
  for (const k of TEXT_FIELDS) if (!e[k]?.trim() && row[k]) set[k] = row[k] as never;
  for (const k of BOOL_FIELDS) if (e[k] === null && row[k] != null) set[k] = row[k];
  if (!e.focus.length && row.focus?.length) set.focus = row.focus;
  if (row.relationship && laterRelationship(e.relationship, row.relationship) !== e.relationship) set.relationship = row.relationship;
  // The contact keeps its first source; a different one is noted. Only the organizer's note is a touch.
  const notes = newNoteLines(e.notes, [note, row.source && row.source !== e.source ? `Also from ${row.source}` : ""], date);
  const touch = newNoteLines(e.notes, [note], date) ? date : null;
  return Object.keys(set).length || notes ? { id: e.id, set, notes, touch } : null;
}

const RANK = sql.raw(`array[${RELATIONSHIPS.map((r) => `'${r}'`).join(", ")}]`);

/** One fill as SQL: each field written only while still empty and notes appended in the database, so nothing filled is ever overwritten. */
export function fillQuery(db: Db, { id, set, notes, touch }: Fill) {
  const v: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(set) as [keyof FillSet, unknown][]) {
    const c = contacts[k];
    // An array inside sql`` would be spread into a list: build the array literal.
    if (k === "focus") v[k] = sql`case when cardinality(${c}) = 0 then array[${sql.join((val as string[]).map((x) => sql`${x}`), sql`, `)}]::text[] else ${c} end`;
    else if (k === "relationship") v[k] = sql`case when array_position(${RANK}, ${c}) < array_position(${RANK}, ${val}::text) then ${val} else ${c} end`;
    else if ((BOOL_FIELDS as readonly string[]).includes(k)) v[k] = sql`coalesce(${c}, ${val})`;
    else v[k] = sql`coalesce(nullif(trim(${c}), ''), ${val})`;
  }
  if (notes) v.notes = sql`case when coalesce(trim(${contacts.notes}), '') = '' then ${notes} else ${contacts.notes} || E'\\n' || ${notes} end`;
  if (touch) v.lastTouchAt = sql`greatest(coalesce(${contacts.lastTouchAt}, ${touch}::date), ${touch}::date)`;
  return db.update(contacts).set(v).where(sql`${contacts.id} = ${id}`);
}

/** A new contact's row: its note as a dated line, and that note's date as the last touch. */
export const newContactRow = (row: Candidate, note: string, date = noteDate()): Candidate => {
  const notes = newNoteLines(null, [note], date);
  return { ...row, notes, lastTouchAt: notes ? date : null };
};

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
    const raw = (c: number) => (c >= 0 ? r[c] : undefined);
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
    // Investor-network columns: unknown values are left empty, never guessed.
    keep.push({
      plan, key, note: cell(m.notes, MAX_NOTE), source,
      name: name || null, email: email || null, headline: plan.headline || null, company: plan.company || null,
      checkedIn: m.checkIn >= 0 ? parseCheckIn(r[m.checkIn]) : null,
      contactType: parseContactType(raw(m.contactType)), focus: parseFocus(raw(m.focus)), stage: parseInvestorStage(raw(m.stage)),
      linkedinUrl: normalizeLinkedin(raw(m.linkedin)), nyuAlum: parseNyuAlum(raw(m.nyuAlum)), relationship: parseRelationship(raw(m.relationship)) ?? undefined,
    });
  });

  // Existing contacts for these rows: by lower(email); email-less ones by name + headline.
  const existing = new Map<string, Existing>();
  const emails = keep.filter((r) => r.email).map((r) => r.email!.toLowerCase());
  for (let i = 0; i < emails.length; i += 500) {
    const found = await db.select({ ...existingCols, k: sql<string>`lower(${contacts.email})` }).from(contacts).where(inArray(sql`lower(${contacts.email})`, emails.slice(i, i + 500)));
    for (const f of found) existing.set(`e:${f.k}`, f);
  }
  const names = [...new Set(keep.filter((r) => !r.email).map((r) => r.name!.toLowerCase()))];
  for (let i = 0; i < names.length; i += 500) {
    const found = await db.select(existingCols).from(contacts).where(and(isNull(contacts.email), inArray(sql`lower(${contacts.name})`, names.slice(i, i + 500))));
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
      inserts.push(newContactRow(row, note, date));
      continue;
    }
    plan.action = "match";
    counts.matched++;
    const fill = planFill(e, row, note, date);
    if (fill) { counts.updated++; fills.push(fill); }
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
  const updates = plan.fills.map((f) => fillQuery(db, f));
  for (let i = 0; i < updates.length; i += 100) {
    const chunk = updates.slice(i, i + 100);
    if (chunk.length) await db.batch(chunk as [typeof chunk[0], ...typeof chunk]);
  }
  return created;
}
