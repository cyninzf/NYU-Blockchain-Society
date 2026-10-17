"use server";

// The contact edit page (round 28.1), both roles: investor fields, company and title, and a dated
// note. Any direction (it's a deliberate edit); every change is logged with old → new.

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { editContact, parseContactEdit } from "@/lib/contact-save";
import type { FieldErrors } from "@/lib/form-errors";

export type EditResult = { ok: true; changed: string[] } | { ok: false; error: string; fieldErrors?: FieldErrors };

export async function saveContactEdit(fd: FormData): Promise<EditResult> {
  const { db, actor } = await requireAdmin();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Bad request." };
  const p = parseContactEdit(fd);
  if (!p.ok) return p;
  const changes = await editContact(db, id, p.data, actor);
  if (!changes) return { ok: false, error: "That contact no longer exists." };
  refresh();
  return { ok: true, changed: Object.keys(changes) };
}
