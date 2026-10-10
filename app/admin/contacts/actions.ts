"use server";

// Contacts: import, linking to members, delete. The import file (.csv or .xlsx) travels in the request body, is parsed in memory and
// dropped: it's never written to disk, logged or stored anywhere except as the resulting rows.

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { audit, auditRow, requireAdmin } from "@/lib/admin";
import { autoLinkContacts, LINK_LABELS, nameMatches } from "@/lib/contact-links";
import { adminAudit, contactLinkBlocks, contacts, members } from "@/lib/db/schema";
import { parseCsv } from "@/lib/csv";
import {
  clean, EMAIL_RE, formatOf, headerRowIndex, isIgnoredColumn, maskEmail, MAX_IMPORT_BYTES, nameHeadlineKey, parseCheckIn, SOURCE_RE,
  type ImportFormat, type ImportSummary, type Mapping,
} from "@/lib/contacts-import";
import { readXlsx } from "@/lib/xlsx";

import { reportError } from "@/lib/monitoring";
export type PreviewResult =
  | { ok: true; headers: string[]; ignored: boolean[]; sample: string[][]; rows: number; format: ImportFormat }
  | { ok: false; error: string };

export type ImportResult = ({ ok: true } & ImportSummary) | { ok: false; error: string };

/** The header row and the rows under it. */
async function readTable(fd: FormData): Promise<{ headers: string[]; data: string[][] } | string> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return "Choose a .csv or .xlsx file.";
  if (file.size > MAX_IMPORT_BYTES) return "That file is over 4 MB. Export only the columns you need.";
  const xlsx = /\.xlsx$/i.test(file.name);
  if (!xlsx && !/\.csv$/i.test(file.name) && !/csv|text\/plain/.test(file.type)) return "Upload a .csv or .xlsx file.";
  let table: string[][];
  try {
    table = xlsx ? readXlsx(Buffer.from(await file.arrayBuffer())) : parseCsv(await file.text());
  } catch {
    return "Couldn't read that file. Upload it as it was downloaded (.xlsx) or saved as .csv.";
  }
  const h = headerRowIndex(table);
  const data = table.slice(h + 1).filter((r) => r.some((c) => c.trim()));
  if (!data.length) return "That file has no rows under the header.";
  return { headers: table[h].map((x) => x.trim().slice(0, 60)), data };
}

/** Step 1: headers and the first 5 rows (emails masked, ignored columns blank), so the admin can map columns. */
export async function previewContacts(fd: FormData): Promise<PreviewResult> {
  await requireAdmin("super_admin");
  const t = await readTable(fd);
  if (typeof t === "string") return { ok: false, error: t };
  const ignored = t.headers.map(isIgnoredColumn);
  const sample = t.data.slice(0, 5).map((r) => t.headers.map((_, i) => {
    if (ignored[i]) return "";
    const v = (r[i] ?? "").trim().slice(0, 80);
    return EMAIL_RE.test(v) ? maskEmail(v) : v;
  }));
  return { ok: true, headers: t.headers, ignored, sample, rows: t.data.length, format: formatOf(t.headers) };
}

const isEmail = (v: string) => v.length <= 254 && EMAIL_RE.test(v) && z.email().safeParse(v).success;

type Candidate = typeof contacts.$inferInsert;

/**
 * Step 2: import with the confirmed mapping. Rows with an email dedupe on it; rows without one
 * (the LinkedIn export) on name + headline. Existing contacts and members are never overwritten.
 * Then every contact is matched against existing members (by email, then by name).
 */
export async function importContacts(fd: FormData): Promise<ImportResult> {
  const { db, actor } = await requireAdmin("super_admin");
  const source = String(fd.get("source") ?? "").trim().toLowerCase();
  if (!SOURCE_RE.test(source)) return { ok: false, error: "Use a short source label: lowercase letters, numbers and dashes, like luma-2024 or linkedin-2026-10." };
  const t = await readTable(fd);
  if (typeof t === "string") return { ok: false, error: t };
  const { headers, data } = t;
  const col = (k: keyof Mapping) => {
    const n = Number(fd.get(k));
    return Number.isInteger(n) && n >= 0 && n < headers.length && !isIgnoredColumn(headers[n]) ? n : -1;
  };
  const m: Mapping = { name: col("name"), email: col("email"), headline: col("headline"), checkIn: col("checkIn") };
  if (m.name < 0 && m.email < 0) return { ok: false, error: "Pick the name column, the email column, or both." };

  const s: ImportSummary = { total: data.length, imported: 0, duplicates: 0, skipped: 0, invalid: 0, linkedByEmail: 0, linkedByName: 0, needsLook: 0 };
  const seen = new Set<string>();
  const withEmail: (Candidate & { email: string })[] = [];
  const noEmail: Candidate[] = [];
  for (const r of data) {
    const cell = (i: number, max: number) => (i >= 0 ? clean(r[i], max) : "");
    const name = cell(m.name, 120) || null, email = cell(m.email, 300), headline = cell(m.headline, 500) || null;
    const row = { name, headline, source, checkedIn: m.checkIn >= 0 ? parseCheckIn(r[m.checkIn]) : null };
    if (email) {
      if (!isEmail(email)) { s.invalid++; continue; }
      const k = `e:${email.toLowerCase()}`;
      if (seen.has(k)) { s.duplicates++; continue; }
      seen.add(k);
      withEmail.push({ ...row, email });
    } else if (name) {
      const k = `n:${nameHeadlineKey(name, headline)}`;
      if (seen.has(k)) { s.duplicates++; continue; }
      seen.add(k);
      noEmail.push({ ...row, email: null });
    } else s.skipped++;
  }

  try {
    for (let i = 0; i < withEmail.length; i += 500) {
      const chunk = withEmail.slice(i, i + 500);
      const keys = chunk.map((c) => c.email.toLowerCase());
      const isContact = new Set((await db.select({ k: sql<string>`lower(${contacts.email})` }).from(contacts)
        .where(inArray(sql`lower(${contacts.email})`, keys))).map((x) => x.k));
      // Emails that are already members are imported too, then linked to them below.
      const fresh = chunk.filter((c) => {
        if (isContact.has(c.email.toLowerCase())) { s.duplicates++; return false; }
        return true;
      });
      if (fresh.length) await insert(fresh);
    }
    // Same name and headline as an existing contact without email: skipped by the unique index.
    for (let i = 0; i < noEmail.length; i += 500) await insert(noEmail.slice(i, i + 500));
  } catch (e) {
    reportError("admin", "contacts import failed", e);
    await audit(db, actor, "contacts.import", `Contacts import "${source}" stopped after ${s.imported} rows`).catch(() => {});
    return { ok: false, error: `The import stopped after ${s.imported} rows because of a database error. Re-run it: rows already imported are skipped.` };
  }
  await audit(db, actor, "contacts.import", `Imported contacts "${source}": ${s.imported} imported, ${s.duplicates} duplicates, ${s.skipped} skipped, ${s.invalid} invalid emails`);
  try {
    const linked = await autoLinkContacts(db);
    s.linkedByEmail = linked.email.length;
    s.linkedByName = linked.name.length;
    s.needsLook = (await nameMatches(db)).review.length;
  } catch (e) {
    // The rows are in; matching runs again after the next join, edit or import.
    reportError("admin", "contact auto-link failed", e);
  }
  refresh();
  return { ok: true, ...s };

  async function insert(rows: Candidate[]) {
    // A concurrent insert of the same row is skipped, never overwritten.
    const inserted = await db.insert(contacts).values(rows).onConflictDoNothing().returning({ id: contacts.id });
    s.imported += inserted.length;
    s.duplicates += rows.length - inserted.length;
  }
}

/** For removal requests; super admins only. Permanent. */
export async function deleteContact(fd: FormData) {
  const { db, actor } = await requireAdmin("super_admin");
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id < 1 || fd.get("confirm") !== "yes") throw new Error("Bad request");
  const [gone] = await db.delete(contacts).where(eq(contacts.id, id)).returning({ id: contacts.id });
  if (gone) await audit(db, actor, "contact.delete", `Deleted contact #${id}`);
  refresh();
}

const intOf = (v: FormDataEntryValue | null) => { const n = Number(String(v ?? "").trim().replace(/^#/, "")); return Number.isInteger(n) && n > 0 ? n : 0; };

/** "Link to member" by hand, for "Needs a look" and anything automatic matching can't see. Both roles. */
export async function linkContact(fd: FormData) {
  const { db, actor } = await requireAdmin();
  const id = intOf(fd.get("id")), memberId = intOf(fd.get("memberId"));
  if (!id || !memberId) throw new Error("Enter a block number.");
  const [m] = await db.select({ id: members.id }).from(members).where(eq(members.id, memberId));
  if (!m) throw new Error(`No member #${memberId}.`);
  const [done] = await db.update(contacts).set({ memberId, linkMethod: "manual" })
    .where(and(eq(contacts.id, id), isNull(contacts.memberId))).returning({ id: contacts.id });
  if (done) await audit(db, actor, "contact.link", `Linked contact #${id} to member #${memberId} (manual)`, { memberId });
  refresh();
}

/** Undo any link (automatic or manual). The pair is remembered and never linked automatically again. Both roles. */
export async function unlinkContact(fd: FormData) {
  const { db, actor } = await requireAdmin();
  const id = intOf(fd.get("id"));
  if (!id) throw new Error("Bad request");
  const [c] = await db.select({ memberId: contacts.memberId, how: contacts.linkMethod }).from(contacts).where(eq(contacts.id, id));
  if (c?.memberId) {
    await db.batch([
      db.update(contacts).set({ memberId: null, linkMethod: null }).where(and(eq(contacts.id, id), eq(contacts.memberId, c.memberId))),
      db.insert(contactLinkBlocks).values({ contactId: id, memberId: c.memberId, actor }).onConflictDoNothing(),
      db.insert(adminAudit).values(auditRow(actor, "contact.unlink",
        `Undid the link of contact #${id} to member #${c.memberId} (${LINK_LABELS[c.how ?? ""] ?? "unknown"}); never auto-linked again`, { memberId: c.memberId })),
    ]);
  }
  refresh();
}
