"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { auditRow, requireSuperOr403 } from "@/lib/admin";
import { adminAudit, settings } from "@/lib/db/schema";
import { postalAddress } from "@/lib/settings";

export type SettingsState = { ok: true; message: string } | { ok: false; error: string } | null;

const Address = z.string().trim().max(300, "Keep the address under 300 characters.");

/** Super admins only; logged with old and new value. */
export async function savePostalAddress(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const { db, actor } = await requireSuperOr403("change the postal address");
  const parsed = Address.safeParse(String(fd.get("postalAddress") ?? "").replace(/\r\n/g, "\n"));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the address." };
  const value = parsed.data;
  const old = await postalAddress(db);
  if ((old ?? "") === value) return { ok: true, message: "No changes." };
  await db.batch([
    db.insert(settings).values({ key: "postal_address", value, updatedBy: actor })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy: actor, updatedAt: new Date() } }),
    db.insert(adminAudit).values(auditRow(actor, "settings.edit", "Postal address", { changes: { "postal address": [old, value || null] } })),
  ]);
  refresh();
  return { ok: true, message: value ? "Saved. It appears in invite and announcement footers." : "Cleared. Invites can't be sent until an address is set." };
}
