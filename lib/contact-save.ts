import "server-only";
// One contact at a time (round 28): the quick-add form (/admin/contacts/new) and the accelerator
// forms. The import's rules (lib/contacts-import-plan.ts): a person who's already a contact is
// matched (by email, else LinkedIn URL, else for email-less rows name + headline) and only gains
// empty fields, a dated note and a relationship further along; never a duplicate, never an email,
// never a member. A "via-" source stays a personal introduction (never in bulk invites, round 26).

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "./db";
import { acceleratorInterest, adminAudit, contacts, type AuditChanges } from "./db/schema";
import { auditRow } from "./admin";
import { MAX_NOTE, newNoteLines, noteDate, slugifySource, SOURCE_RE } from "./contacts-import";
import { CONTACT_FOCUS, CONTACT_TYPES, INVESTOR_STAGES, normalizeLinkedin, RELATIONSHIPS } from "./contact-fields";
import { zodFieldErrors, type FieldErrors } from "./form-errors";
import { existingCols, fillQuery, newContactRow, planFill, type Candidate, type Existing } from "./contacts-import-plan";

export type ContactDraft = Candidate & { source: string };

/** The existing contact for this person, if any: email first, then LinkedIn URL, then (no email) name + headline, as the unique index has it. */
export async function findContact(db: Db, d: Pick<Candidate, "email" | "linkedinUrl" | "name" | "headline">): Promise<Existing | null> {
  if (d.email) {
    const [e] = await db.select(existingCols).from(contacts).where(eq(sql`lower(${contacts.email})`, d.email.trim().toLowerCase()));
    if (e) return e;
  }
  if (d.linkedinUrl) {
    const [l] = await db.select(existingCols).from(contacts).where(eq(contacts.linkedinUrl, d.linkedinUrl)).orderBy(contacts.id).limit(1);
    if (l) return l;
  }
  if (!d.email && d.name) {
    const [n] = await db.select(existingCols).from(contacts)
      .where(and(isNull(contacts.email), eq(sql`lower(${contacts.name})`, d.name.toLowerCase()), eq(sql`lower(coalesce(${contacts.headline}, ''))`, (d.headline ?? "").toLowerCase())));
    if (n) return n;
  }
  return null;
}

/** Fills an existing contact from `d` (empty fields only, a dated note, a relationship only forward). Returns the fields that changed. */
export async function fillContact(db: Db, e: Existing, d: ContactDraft, note: string, date = noteDate()): Promise<string[]> {
  // An email is only added while the contact has none and nobody else has it.
  const draft = { ...d };
  if (draft.email && (await findContact(db, { email: draft.email }))) delete draft.email;
  const fill = planFill(e, draft, note, date);
  const emailSet = !e.email && draft.email;
  if (!fill && !emailSet) return [];
  if (fill) await fillQuery(db, fill);
  if (emailSet) await db.update(contacts).set({ email: draft.email }).where(and(eq(contacts.id, e.id), isNull(contacts.email))).catch(() => {});
  return [...Object.keys(fill?.set ?? {}), ...(fill?.notes ? ["notes"] : []), ...(emailSet ? ["email"] : [])];
}

/**
 * Create, or fill the person who's already there. A concurrent insert of the same email (the unique
 * index) is caught and filled instead, so two submissions never make two contacts.
 */
export async function saveContact(db: Db, d: ContactDraft, note: string, date = noteDate()): Promise<{ id: number; created: boolean; filled: string[] }> {
  const e = await findContact(db, d);
  if (e) return { id: e.id, created: false, filled: await fillContact(db, e, d, note, date) };
  const [row] = await db.insert(contacts).values(newContactRow(d, note, date)).onConflictDoNothing().returning({ id: contacts.id });
  if (row) return { id: row.id, created: true, filled: [] };
  const again = await findContact(db, d);
  if (!again) throw new Error("contact insert conflicted but no match was found");
  return { id: again.id, created: false, filled: await fillContact(db, again, d, note, date) };
}

/**
 * Quick-add's default source: the signed-in organizer's own introductions, "via-<display name>"
 * (round 28.1, set on /admin/team), else "via-<their email name>".
 */
export const organizerSource = (email: string, displayName?: string | null) =>
  slugifySource(`via ${displayName?.trim() || email.split("@")[0]}`) || "via-organizer";

const opt = (max: number, msg: string) => z.string().trim().max(max, msg).transform((v) => v || null);
const optEnum = <T extends readonly [string, ...string[]]>(values: T) => z.union([z.literal(""), z.enum(values)]).transform((v) => (v || null) as T[number] | null);

export const QuickAddInput = z.object({
  name: z.string().trim().min(1, "Add their name.").max(120, "Keep the name under 120 characters."),
  email: z.union([z.literal(""), z.email("Use a full email address, like name@example.com, or leave it empty.").max(254)]).transform((v) => v.toLowerCase() || null),
  company: opt(200, "Keep the company under 200 characters."),
  headline: opt(500, "Keep the title under 500 characters."),
  linkedinUrl: z.string().trim().max(300).refine((v) => !v || normalizeLinkedin(v), "Use a linkedin.com profile URL, or leave it empty.").transform((v) => normalizeLinkedin(v)),
  contactType: optEnum(CONTACT_TYPES),
  focus: z.array(z.enum(CONTACT_FOCUS)).transform((v) => CONTACT_FOCUS.filter((f) => v.includes(f))),
  stage: optEnum(INVESTOR_STAGES),
  nyuAlum: z.enum(["", "yes", "no"]).transform((v) => (v === "" ? null : v === "yes")),
  relationship: z.enum(RELATIONSHIPS),
  note: z.string().trim().max(MAX_NOTE, `Keep the note under ${MAX_NOTE.toLocaleString("en-US")} characters.`).transform((v) => v.replace(/\s+/g, " ")),
  source: z.string().trim().toLowerCase().regex(SOURCE_RE, "Use a short source: lowercase letters, numbers and dashes, like via-alex."),
});
export type QuickAdd = z.output<typeof QuickAddInput>;

export function parseQuickAdd(fd: FormData): { ok: true; data: QuickAdd } | { ok: false; error: string; fieldErrors: FieldErrors } {
  const s = (k: string) => String(fd.get(k) ?? "");
  const r = QuickAddInput.safeParse({
    name: s("name"), email: s("email"), company: s("company"), headline: s("headline"), linkedinUrl: s("linkedinUrl"), contactType: s("contactType"),
    focus: fd.getAll("focus").map(String), stage: s("stage"), nyuAlum: s("nyuAlum"), relationship: s("relationship") || "cold", note: s("note"), source: s("source"),
  });
  return r.success ? { ok: true, data: r.data } : { ok: false, error: r.error.issues[0]?.message ?? "Check the form.", fieldErrors: zodFieldErrors(r.error) };
}

/** A quick-add as a contact draft (the note is passed separately). */
export function draftOf(q: QuickAdd): ContactDraft {
  const d: Partial<QuickAdd> = { ...q };
  delete d.note;
  return d as ContactDraft;
}

// The contact edit page (/admin/contacts/<id>, round 28.1), both roles: a deliberate organizer
// edit, so any field may change in any direction (the relationship too, unlike imports and forms),
// each change logged with old → new. A note is appended as a dated line and moves the last touch.

export const ContactEditInput = QuickAddInput.pick({ company: true, headline: true, linkedinUrl: true, contactType: true, focus: true, stage: true, nyuAlum: true, relationship: true, note: true });
export type ContactEdit = z.output<typeof ContactEditInput>;

export function parseContactEdit(fd: FormData): { ok: true; data: ContactEdit } | { ok: false; error: string; fieldErrors: FieldErrors } {
  const s = (k: string) => String(fd.get(k) ?? "");
  const r = ContactEditInput.safeParse({
    company: s("company"), headline: s("headline"), linkedinUrl: s("linkedinUrl"), contactType: s("contactType"), focus: fd.getAll("focus").map(String),
    stage: s("stage"), nyuAlum: s("nyuAlum"), relationship: s("relationship"), note: s("note"),
  });
  return r.success ? { ok: true, data: r.data } : { ok: false, error: r.error.issues[0]?.message ?? "Check the form.", fieldErrors: zodFieldErrors(r.error) };
}

const EDIT_FIELDS = ["company", "headline", "linkedinUrl", "contactType", "focus", "stage", "nyuAlum", "relationship"] as const;
const asText = (v: unknown) => (v === null || v === undefined ? null : Array.isArray(v) ? (v.length ? v.join(", ") : null) : String(v));

/** Applies an edit; returns null when the contact is gone, else the logged changes (a note shows as `note: [null, "added"]`, never its text). */
export async function editContact(db: Db, id: number, d: ContactEdit, actor: string, date = noteDate()): Promise<AuditChanges | null> {
  const [c] = await db.select().from(contacts).where(eq(contacts.id, id));
  if (!c) return null;
  const set: Record<string, unknown> = {}, changes: AuditChanges = {};
  for (const k of EDIT_FIELDS) {
    const before = asText(c[k]), after = asText(d[k]);
    if (before !== after) { set[k] = d[k]; changes[k] = [before, after]; }
  }
  const notes = newNoteLines(c.notes, [d.note], date);
  if (notes) {
    set.notes = sql`case when coalesce(trim(${contacts.notes}), '') = '' then ${notes} else ${contacts.notes} || E'\\n' || ${notes} end`;
    set.lastTouchAt = sql`greatest(coalesce(${contacts.lastTouchAt}, ${date}::date), ${date}::date)`;
    changes.note = [null, "added"];
  }
  if (!Object.keys(set).length) return changes;
  await db.batch([
    db.update(contacts).set(set).where(eq(contacts.id, id)),
    db.insert(adminAudit).values(auditRow(actor, "contact.edit", `Edited contact #${id}`, { changes })),
  ]);
  return changes;
}

/**
 * For removal requests (round 28.1, super admins, checked by the caller): deletes a contact and,
 * with `alsoLinked`, the accelerator submissions linked to it. Permanent; logged without content.
 * Returns the ids deleted, or null when the contact was already gone.
 */
export async function deleteContactWithLinked(db: Db, id: number, actor: string, alsoLinked: boolean): Promise<{ accelerator: number[] } | null> {
  const linked = alsoLinked ? await db.select({ id: acceleratorInterest.id, type: acceleratorInterest.type }).from(acceleratorInterest).where(eq(acceleratorInterest.contactId, id)) : [];
  const [gone] = await db.delete(contacts).where(eq(contacts.id, id)).returning({ id: contacts.id });
  if (!gone) return null;
  if (linked.length) await db.delete(acceleratorInterest).where(inArray(acceleratorInterest.id, linked.map((l) => l.id)));
  await db.batch([
    db.insert(adminAudit).values(auditRow(actor, "contact.delete", `Deleted contact #${id}${linked.length ? ` and its linked accelerator ${linked.length === 1 ? "row" : "rows"} ${linked.map((l) => `#${l.id}`).join(", ")}` : ""}`)),
    ...linked.map((l) => db.insert(adminAudit).values(auditRow(actor, "accelerator.delete", `Deleted accelerator ${l.type} #${l.id} (linked to deleted contact #${id})`))),
  ]);
  return { accelerator: linked.map((l) => l.id) };
}

/** Accelerator rows linked to these contacts, for the contacts list's delete step and the edit page. */
export async function linkedInterest(db: Db, contactIds: number[]) {
  if (!contactIds.length) return new Map<number, { id: number; type: string }[]>();
  const rows = await db.select({ id: acceleratorInterest.id, type: acceleratorInterest.type, contactId: acceleratorInterest.contactId }).from(acceleratorInterest).where(inArray(acceleratorInterest.contactId, contactIds));
  const m = new Map<number, { id: number; type: string }[]>();
  for (const r of rows) m.set(r.contactId!, [...(m.get(r.contactId!) ?? []), { id: r.id, type: r.type }]);
  return m;
}
