"use server";

// Contacts import. The CSV travels in the request body, is parsed in memory and dropped:
// it's never written to disk, logged or stored anywhere except as the resulting rows.

import { eq, inArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { audit, requireAdmin } from "@/lib/admin";
import { contacts, members } from "@/lib/db/schema";
import { parseCsv } from "@/lib/csv";
import { EMAIL_RE, maskEmail, MAX_IMPORT_BYTES, parseCheckIn, SOURCE_RE, type ImportSummary, type Mapping } from "@/lib/contacts-import";

export type PreviewResult =
  | { ok: true; headers: string[]; sample: string[][]; rows: number }
  | { ok: false; error: string };

export type ImportResult = ({ ok: true } & ImportSummary) | { ok: false; error: string };

async function readCsv(fd: FormData): Promise<string[][] | string> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return "Choose a CSV file.";
  if (file.size > MAX_IMPORT_BYTES) return "That file is over 4 MB. Export only the columns you need.";
  if (!/\.csv$/i.test(file.name) && !/csv|text\/plain/.test(file.type)) return "Upload a .csv file.";
  const rows = parseCsv(await file.text());
  if (rows.length < 2) return "That file has no rows under the header.";
  return rows;
}

/** Step 1: headers and the first 5 rows (emails masked), so the admin can map columns. */
export async function previewContacts(fd: FormData): Promise<PreviewResult> {
  await requireAdmin("super_admin");
  const rows = await readCsv(fd);
  if (typeof rows === "string") return { ok: false, error: rows };
  const [headers, ...data] = rows;
  const sample = data.slice(0, 5).map((r) => headers.map((_, i) => {
    const v = (r[i] ?? "").trim().slice(0, 80);
    return EMAIL_RE.test(v) ? maskEmail(v) : v;
  }));
  return { ok: true, headers: headers.map((h) => h.trim().slice(0, 60)), sample, rows: data.length };
}

const isEmail = (v: string) => v.length <= 254 && EMAIL_RE.test(v) && z.email().safeParse(v).success;

/** Step 2: import with the confirmed mapping. Never overwrites existing contacts or members. */
export async function importContacts(fd: FormData): Promise<ImportResult> {
  const { db, actor } = await requireAdmin("super_admin");
  const source = String(fd.get("source") ?? "").trim().toLowerCase();
  if (!SOURCE_RE.test(source)) return { ok: false, error: "Use a short source label: lowercase letters, numbers and dashes, like conference-2024." };
  const rows = await readCsv(fd);
  if (typeof rows === "string") return { ok: false, error: rows };
  const [headers, ...data] = rows;
  const col = (k: keyof Mapping) => { const n = Number(fd.get(k)); return Number.isInteger(n) && n >= 0 && n < headers.length ? n : -1; };
  const m: Mapping = { name: col("name"), email: col("email"), checkIn: col("checkIn") };
  if (m.email < 0) return { ok: false, error: "Pick the column that holds email addresses." };

  const s: ImportSummary = { total: data.length, imported: 0, duplicates: 0, invalid: 0, alreadyMembers: 0 };
  const seen = new Set<string>();
  const candidates: (typeof contacts.$inferInsert & { email: string })[] = [];
  for (const r of data) {
    const email = (r[m.email] ?? "").trim();
    if (!isEmail(email)) { s.invalid++; continue; }
    const key = email.toLowerCase();
    if (seen.has(key)) { s.duplicates++; continue; }
    seen.add(key);
    candidates.push({
      name: m.name >= 0 ? (r[m.name] ?? "").trim().slice(0, 120) || null : null,
      email,
      source,
      checkedIn: m.checkIn >= 0 ? parseCheckIn(r[m.checkIn]) : null,
    });
  }

  try {
    for (let i = 0; i < candidates.length; i += 500) {
      const chunk = candidates.slice(i, i + 500);
      const keys = chunk.map((c) => c.email.toLowerCase());
      const [isMember, isContact] = await Promise.all([
        db.select({ k: sql<string>`lower(${members.email})` }).from(members).where(inArray(sql`lower(${members.email})`, keys)),
        db.select({ k: sql<string>`lower(${contacts.email})` }).from(contacts).where(inArray(sql`lower(${contacts.email})`, keys)),
      ]).then((rs) => rs.map((x) => new Set(x.map((y) => y.k))));
      const fresh = chunk.filter((c) => {
        const k = c.email.toLowerCase();
        if (isMember.has(k)) { s.alreadyMembers++; return false; }
        if (isContact.has(k)) { s.duplicates++; return false; }
        return true;
      });
      if (!fresh.length) continue;
      // A concurrent insert of the same email is skipped, never overwritten.
      const inserted = await db.insert(contacts).values(fresh).onConflictDoNothing().returning({ id: contacts.id });
      s.imported += inserted.length;
      s.duplicates += fresh.length - inserted.length;
    }
  } catch (e) {
    console.error("contacts import failed", e instanceof Error ? e.message : e);
    await audit(db, actor, "contacts.import", `Contacts import "${source}" stopped after ${s.imported} rows`).catch(() => {});
    return { ok: false, error: `The import stopped after ${s.imported} rows because of a database error. Re-run it: rows already imported are skipped.` };
  }
  await audit(db, actor, "contacts.import", `Imported contacts "${source}": ${s.imported} imported, ${s.duplicates} duplicates, ${s.invalid} invalid, ${s.alreadyMembers} already members`);
  refresh();
  return { ok: true, ...s };
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
