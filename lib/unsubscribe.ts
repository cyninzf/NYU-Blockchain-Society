import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "./db";
import { contacts } from "./db/schema";
import { contactFromUnsubscribeToken } from "./invite-email";
import { suppress } from "./invites";
import { memberFromUnsubscribeToken, setUnsubscribed } from "./member-email";

// Every unsubscribe link: a member's (stops every member email; can be undone) or a contact's
// from an invite (the address goes on the suppression list for good).

export type UnsubTarget = { kind: "member"; id: number } | { kind: "contact"; id: number };

export function unsubscribeTarget(t: string): UnsubTarget | null {
  const c = contactFromUnsubscribeToken(t);
  if (c) return { kind: "contact", id: c };
  const m = memberFromUnsubscribeToken(t);
  return m ? { kind: "member", id: m } : null;
}

/** True when the member or contact exists. A contact can't be resubscribed. */
export async function applyUnsubscribe(db: Db, target: UnsubTarget, on: boolean): Promise<boolean> {
  if (target.kind === "member") return setUnsubscribed(db, target.id, on);
  const [c] = await db.select({ email: contacts.email }).from(contacts).where(eq(contacts.id, target.id));
  if (!c?.email) return false;
  if (on) await suppress(db, c.email, "unsubscribe");
  return true;
}
