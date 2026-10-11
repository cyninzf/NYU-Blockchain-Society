"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { auditRow, requireSuperOr403 } from "@/lib/admin";
import { adminAudit, settings } from "@/lib/db/schema";
import { getSetting, postalAddress } from "@/lib/settings";
import { activeAdmins, buildDigest, digestEmail, invalidRecipient, parseRecipients } from "@/lib/digest";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/member-email";

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

/** Super admins only: the welcome email exactly as a new member gets it, to the signed-in super admin. */
export async function sendWelcomeTest(): Promise<SettingsState> {
  const { db, admin, actor } = await requireSuperOr403("send a test welcome email");
  const r = await sendEmail(db, "welcome-test", welcomeEmail(admin.email, null, false, null));
  if (!r.ok) return { ok: false, error: r.error };
  await db.insert(adminAudit).values(auditRow(actor, "welcome.test", `Test welcome email sent to ${admin.email}`));
  return { ok: true, message: `Sent to ${admin.email}.` };
}

/** Organizers who get the daily digest besides the super admin. Only active admins can be listed (it holds names). Logged old → new. */
export async function saveDigestRecipients(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const { db, actor } = await requireSuperOr403("change the digest recipients");
  const list = parseRecipients(String(fd.get("digestRecipients") ?? "")).slice(0, 20);
  const bad = invalidRecipient(list);
  if (bad) return { ok: false, error: `"${bad.slice(0, 80)}" isn't an email address.` };
  const admins = await activeAdmins(db, list);
  const outsider = list.find((e) => !admins.has(e));
  if (outsider) return { ok: false, error: `${outsider} isn't an organizer. Add them under Team first: the digest lists members' names.` };
  const value = list.join("\n");
  const old = await getSetting(db, "digest_recipients");
  if ((old ?? "") === value) return { ok: true, message: "No changes." };
  await db.batch([
    db.insert(settings).values({ key: "digest_recipients", value, updatedBy: actor })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy: actor, updatedAt: new Date() } }),
    db.insert(adminAudit).values(auditRow(actor, "settings.edit", "Digest recipients", { changes: { "digest recipients": [old, value || null] } })),
  ]);
  refresh();
  return { ok: true, message: list.length ? `Saved. The digest goes to the super admin and ${list.length} more.` : "Saved. The digest goes to the super admin only." };
}

/** Super admins only: today's digest as it stands (even on a quiet day), to the signed-in super admin. */
export async function sendDigestTest(): Promise<SettingsState> {
  const { db, admin, actor } = await requireSuperOr403("send a test digest");
  const r = await sendEmail(db, "digest-test", digestEmail(await buildDigest(db), admin.email, true));
  if (!r.ok) return { ok: false, error: r.error };
  await db.insert(adminAudit).values(auditRow(actor, "digest.test", "Test digest sent to 1 recipient"));
  return { ok: true, message: `Sent to ${admin.email}.` };
}
