import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "./db";
import { settings } from "./db/schema";

// Settings super admins change at /admin/settings, stored in the database.

export const SETTING_KEYS = ["postal_address"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export async function getSetting(db: Db, key: SettingKey): Promise<string | null> {
  const [r] = await db.select({ v: settings.value }).from(settings).where(eq(settings.key, key));
  return r?.v.trim() || null;
}

/** The society's postal address, for invite and announcement footers. Invites can't be sent without it. */
export const postalAddress = (db: Db) => getSetting(db, "postal_address");
