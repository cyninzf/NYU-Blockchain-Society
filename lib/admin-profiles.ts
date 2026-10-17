import "server-only";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { auditRow } from "./admin";
import type { Db } from "./db";
import { adminAudit, adminProfiles } from "./db/schema";

// Organizers' display names (round 28.1): set by super admins on /admin/team, for the recovery
// super admin too. Used for quick-add's default source (via-<display name>).

const norm = (e: string) => e.trim().toLowerCase();

/** 1 to 40 letters, spaces, hyphens, apostrophes or dots; empty clears it. */
export const DisplayName = z.string().trim().max(40, "Keep the display name under 40 characters.")
  .refine((v) => !v || /^[\p{L}][\p{L} .'-]*$/u.test(v), "Use letters, spaces, hyphens or apostrophes, like Fang.");

export async function displayNameFor(db: Db, email: string): Promise<string | null> {
  const [r] = await db.select({ name: adminProfiles.displayName }).from(adminProfiles).where(eq(adminProfiles.email, norm(email)));
  return r?.name ?? null;
}

export async function displayNames(db: Db, emails: string[]): Promise<Map<string, string>> {
  if (!emails.length) return new Map();
  const rows = await db.select().from(adminProfiles).where(inArray(adminProfiles.email, emails.map(norm)));
  return new Map(rows.map((r) => [r.email, r.displayName]));
}

/** Sets or clears one organizer's display name; logged as team.display_name with old → new. Returns whether it changed. */
export async function setDisplayName(db: Db, email: string, name: string, actor: string): Promise<boolean> {
  const e = norm(email), next = name.trim() || null;
  const old = await displayNameFor(db, e);
  if (old === next) return false;
  const write = next
    ? db.insert(adminProfiles).values({ email: e, displayName: next, updatedBy: actor }).onConflictDoUpdate({ target: adminProfiles.email, set: { displayName: next, updatedBy: actor, updatedAt: new Date() } })
    : db.delete(adminProfiles).where(eq(adminProfiles.email, e));
  await db.batch([write, db.insert(adminAudit).values(auditRow(actor, "team.display_name", `Display name of ${e}`, { changes: { displayName: [old, next] } }))]);
  return true;
}
