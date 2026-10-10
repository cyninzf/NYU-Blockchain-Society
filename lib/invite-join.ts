import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { auditRow } from "./admin";
import type { Db } from "./db";
import { adminAudit, contactLinkBlocks, contacts } from "./db/schema";
import { contactFromInviteToken } from "./invite-email";

/** The invited address, to pre-fill the join flow: only for a valid, unused token of an unlinked contact. */
export async function invitedEmail(db: Db, token: string): Promise<string | null> {
  const id = contactFromInviteToken(token);
  if (!id) return null;
  const [c] = await db.select({ email: contacts.email }).from(contacts)
    .where(and(eq(contacts.id, id), isNull(contacts.inviteUsedAt), isNull(contacts.memberId)));
  return c?.email ?? null;
}

/**
 * Joining with an invite link: the token is spent (it works once) and the contact is linked to the
 * new member ("auto (invite)", logged as "system"), even if they joined with another address.
 * Never a pair an admin undid. Returns whether it linked.
 */
export async function spendInviteToken(db: Db, token: string, memberId: number): Promise<boolean> {
  const id = contactFromInviteToken(token);
  if (!id) return false;
  const [spent] = await db.update(contacts).set({ inviteUsedAt: new Date() })
    .where(and(eq(contacts.id, id), isNull(contacts.inviteUsedAt))).returning({ memberId: contacts.memberId });
  if (!spent || spent.memberId) return false;
  const [linked] = await db.update(contacts).set({ memberId, linkMethod: "invite" })
    .where(and(eq(contacts.id, id), isNull(contacts.memberId),
      sql`not exists (select 1 from ${contactLinkBlocks} b where b.contact_id = ${id} and b.member_id = ${memberId})`))
    .returning({ id: contacts.id });
  if (linked) await db.insert(adminAudit).values(auditRow("system", "contact.autolink", `Linked contact #${id} to member #${memberId} (auto, invite)`, { memberId }));
  return Boolean(linked);
}
