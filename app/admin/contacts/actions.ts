"use server";

// Contacts: import, linking to members, delete. The import file (.csv or .xlsx) travels in the request body, is parsed in memory and
// dropped: it's never written to disk, logged or stored anywhere except as the resulting rows.

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { audit, auditRow, requireAdmin } from "@/lib/admin";
import { autoLinkContacts, LINK_LABELS, nameMatches } from "@/lib/contact-links";
import { adminAudit, contactLinkBlocks, contacts, members } from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import {
  formatOf, guessMapping, headerRowIndex, isIgnoredColumn, linkedinSource, MAPPING_KEYS, MAX_IMPORT_BYTES, SOURCE_RE,
  type ImportCounts, type ImportFormat, type ImportSummary, type Mapping, type PlanRow,
} from "@/lib/contacts-import";
import { applyImport, planImport } from "@/lib/contacts-import-plan";
import { readXlsx } from "@/lib/xlsx";

import { reportError } from "@/lib/monitoring";
export type PreviewResult =
  | {
    ok: true; headers: string[]; ignored: boolean[]; mapping: Mapping; format: ImportFormat;
    /** The import's source label as it will be used (a LinkedIn export left empty gets this month's). */
    label: string;
    counts: ImportCounts; missingSource: number;
    /** The first rows with what happens to each; every skipped row (up to 200) with its reason. */
    sample: PlanRow[]; skippedRows: PlanRow[];
  }
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

type Request = { data: string[][]; headers: string[]; m: Mapping; label: string; format: ImportFormat };

/** The file, the mapping (guessed from the headers until the admin picks one) and the source label. */
async function readRequest(fd: FormData): Promise<Request | string> {
  const t = await readTable(fd);
  if (typeof t === "string") return t;
  const { headers, data } = t;
  const format = formatOf(headers);
  let m = guessMapping(headers);
  if (fd.get("mapped") === "1") {
    const col = (k: keyof Mapping) => {
      const n = Number(fd.get(k));
      return Number.isInteger(n) && n >= 0 && n < headers.length && !isIgnoredColumn(headers[n]) ? n : -1;
    };
    m = Object.fromEntries(MAPPING_KEYS.map((k) => [k, col(k)])) as Mapping;
  }
  if (format === "list" && m.email < 0) return "Pick the email column. Only a LinkedIn group export can be imported without emails.";
  if (m.name < 0 && m.email < 0) return "Pick the name column, the email column, or both.";
  let label = String(fd.get("source") ?? "").trim().toLowerCase();
  if (label && !SOURCE_RE.test(label)) return "Use a short source label: lowercase letters, numbers and dashes, like luma-2024.";
  if (!label && format === "linkedin") label = linkedinSource();
  return { data, headers, m, label, format };
}

const needLabel = (n: number) => `${n} ${n === 1 ? "row has" : "rows have"} no source of ${n === 1 ? "its" : "their"} own. Add a source label for them, like luma-2024.`;

/**
 * Step 1, and again whenever the mapping or label changes: a dry run of the whole import. Nothing
 * is written. Returns the counts (new, matched, skipped), each row's source and every skipped row
 * with its reason; emails masked.
 */
export async function previewContacts(fd: FormData): Promise<PreviewResult> {
  const { db } = await requireAdmin("super_admin");
  const r = await readRequest(fd);
  if (typeof r === "string") return { ok: false, error: r };
  const plan = await planImport(db, r.data, r.m, r.label, r.format);
  return {
    ok: true, headers: r.headers, ignored: r.headers.map(isIgnoredColumn), mapping: r.m, format: r.format, label: r.label,
    counts: plan.counts, missingSource: plan.missingSource,
    sample: plan.rows.slice(0, 20), skippedRows: plan.rows.filter((x) => x.action === "skip").slice(0, 200),
  };
}

/**
 * Step 2: the same plan as the preview, then written. New rows become contacts; a row matching
 * an existing contact (email, case-insensitive and trimmed) only fills its empty fields and appends
 * dated notes ("Also from <source>" when its source differs). Contacts only: never a member, never
 * an email. Then every contact is matched against existing members (by email, then by name).
 */
export async function importContacts(fd: FormData): Promise<ImportResult> {
  const { db, actor } = await requireAdmin("super_admin");
  const r = await readRequest(fd);
  if (typeof r === "string") return { ok: false, error: r };
  const plan = await planImport(db, r.data, r.m, r.label, r.format);
  if (plan.missingSource) return { ok: false, error: needLabel(plan.missingSource) };
  const s: ImportSummary = { ...plan.counts, linkedByEmail: 0, linkedByName: 0, needsLook: 0 };
  const sources = Object.keys(s.bySource).slice(0, 10).join(", ") + (Object.keys(s.bySource).length > 10 ? ", …" : "");
  try {
    s.created = await applyImport(db, plan);
  } catch (e) {
    reportError("admin", "contacts import failed", e);
    await audit(db, actor, "contacts.import", `Contacts import (${sources}) stopped by a database error`).catch(() => {});
    return { ok: false, error: "The import stopped because of a database error. Re-run it: rows already imported match and nothing is added twice." };
  }
  await audit(db, actor, "contacts.import", `Imported contacts (${sources}): ${s.created} new, ${s.matched} matched (${s.updated} updated), ${s.skipped} skipped`);
  await linkAfterImport(db, s);
  refresh();
  return { ok: true, ...s };
}

async function linkAfterImport(db: Db, s: ImportSummary) {
  try {
    const linked = await autoLinkContacts(db);
    s.linkedByEmail = linked.email.length;
    s.linkedByName = linked.name.length;
    s.needsLook = (await nameMatches(db)).review.length;
  } catch (e) {
    // The rows are in; matching runs again after the next join, edit or import.
    reportError("admin", "contact auto-link failed", e);
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
