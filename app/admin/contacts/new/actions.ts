"use server";

// Quick-add (round 28), both roles: one contact by hand. If the person is already a contact (email,
// else LinkedIn URL) they're shown first, and the organizer can add a note and fill empty fields
// instead of creating a duplicate. Contacts only: never a member, never an email.

import { refresh } from "next/cache";
import { audit, requireAdmin } from "@/lib/admin";
import { autoLinkQuietly } from "@/lib/contact-links";
import { draftOf, fillContact, findContact, parseQuickAdd, saveContact } from "@/lib/contact-save";
import { CONTACT_TYPE_LABELS, RELATIONSHIP_LABELS } from "@/lib/contact-fields";
import type { FieldErrors } from "@/lib/form-errors";

export type QuickAddMatch = { id: number; name: string | null; email: string | null; company: string | null; headline: string | null; linkedinUrl: string | null; type: string | null; relationship: string; source: string; via: "email" | "linkedin" | "name" };
export type QuickAddResult =
  | { ok: true; id: number; created: boolean; filled: string[]; source: string }
  | { ok: false; error?: string; fieldErrors?: FieldErrors; match?: QuickAddMatch };

export async function quickAddContact(fd: FormData): Promise<QuickAddResult> {
  const { db, actor } = await requireAdmin();
  const p = parseQuickAdd(fd);
  if (!p.ok) return { ok: false, error: p.error, fieldErrors: p.fieldErrors };
  const d = draftOf(p.data);
  const e = await findContact(db, d);
  const fillId = Number(fd.get("fill"));
  if (e && e.id !== fillId) {
    // Shown first; filling needs a second press that names this contact.
    const via = d.email && e.email?.toLowerCase() === d.email ? "email" : d.linkedinUrl && e.linkedinUrl === d.linkedinUrl ? "linkedin" : "name";
    return { ok: false, match: {
      id: e.id, name: e.name, email: e.email, company: e.company, headline: e.headline, linkedinUrl: e.linkedinUrl, source: e.source, via,
      type: e.contactType ? CONTACT_TYPE_LABELS[e.contactType] : null, relationship: RELATIONSHIP_LABELS[e.relationship] ?? e.relationship,
    } };
  }
  if (e) {
    const filled = await fillContact(db, e, d, p.data.note);
    await audit(db, actor, "contact.fill", `Quick-add on existing contact #${e.id}: ${filled.length ? filled.join(", ") : "nothing new"}`);
    refresh();
    return { ok: true, id: e.id, created: false, filled, source: e.source };
  }
  if (fillId) return { ok: false, error: "That contact isn't there any more. Check the details and add them again." };
  const r = await saveContact(db, d, p.data.note);
  await audit(db, actor, r.created ? "contact.create" : "contact.fill", r.created ? `Added contact #${r.id} by hand (source ${d.source})` : `Quick-add on existing contact #${r.id}: ${r.filled.join(", ") || "nothing new"}`);
  // A contact whose email belongs to a member is linked to them, as after an import.
  await autoLinkQuietly(db);
  refresh();
  return { ok: true, ...r, source: d.source };
}
