"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { audit, auditRow, requireAdmin } from "@/lib/admin";
import { adminAudit, AFFILIATIONS, contacts, members, type AuditChanges } from "@/lib/db/schema";

const idOf = (fd: FormData) => {
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id < 1) throw new Error("Bad id");
  return id;
};

export async function setWallApproved(fd: FormData) {
  const { db, actor } = await requireAdmin();
  const id = idOf(fd), on = fd.get("approved") === "1";
  await db.batch([
    db.update(members).set({ wallApproved: on }).where(eq(members.id, id)),
    db.insert(adminAudit).values(auditRow(actor, on ? "wall.approve" : "wall.unapprove", `${on ? "Approved" : "Unapproved"} the wall entry of #${id}`, { memberId: id })),
  ]);
  updateTag("wall");
  refresh();
}

/**
 * For removal requests; super admins only. Permanent: the member's audit rows go with it (they
 * hold old emails), and the delete itself is logged without any personal data.
 */
export async function deleteMember(fd: FormData) {
  const { db, actor } = await requireAdmin("super_admin");
  if (fd.get("confirm") !== "yes") throw new Error("Not confirmed");
  const id = idOf(fd);
  const [gone] = await db.delete(members).where(eq(members.id, id)).returning({ id: members.id });
  if (gone) await audit(db, actor, "member.delete", `Deleted member #${id}`);
  updateTag("wall");
  refresh();
}

export type EditResult = { ok: true; message: string } | { ok: false; error: string } | null;

const EditInput = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, "Add a name.").max(120, "Keep the name under 120 characters."),
  email: z.string().trim().max(254).pipe(z.email("Enter a valid email address.")),
  affiliation: z.enum(AFFILIATIONS),
});

/**
 * Change a member's name, email and affiliation. The block number (id) never changes. Email
 * stays unique on lower(email): another member's email is refused; a contact's email links that
 * contact to this member. Every change is logged in admin_audit.
 */
export async function updateMember(_prev: EditResult, fd: FormData): Promise<EditResult> {
  const { db, actor } = await requireAdmin();
  const parsed = EditInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const input = parsed.data;

  const [m] = await db.select().from(members).where(eq(members.id, input.id));
  if (!m) return { ok: false, error: `Member #${input.id} no longer exists.` };

  const changes: AuditChanges = {};
  if (input.name !== m.name) changes.name = [m.name, input.name];
  if (input.email !== m.email) changes.email = [m.email, input.email];
  if (input.affiliation !== m.affiliation) changes.affiliation = [m.affiliation, input.affiliation];
  if (!Object.keys(changes).length) return { ok: true, message: "No changes." };

  // A different address (not just different capitals): check it against members and contacts.
  let linkContact: number | null = null;
  if (input.email.toLowerCase() !== m.email.toLowerCase()) {
    const key = input.email.toLowerCase();
    const [other] = await db.select({ id: members.id }).from(members)
      .where(and(eq(sql`lower(${members.email})`, key), ne(members.id, m.id)));
    if (other) return { ok: false, error: `That email already belongs to member #${other.id}. Nothing was saved.` };
    const [c] = await db.select({ id: contacts.id, memberId: contacts.memberId, source: contacts.source }).from(contacts)
      .where(eq(sql`lower(${contacts.email})`, key));
    if (c?.memberId && c.memberId !== m.id) return { ok: false, error: `That email is a contact already linked to member #${c.memberId}. Nothing was saved.` };
    if (c && c.memberId !== m.id) { linkContact = c.id; changes.contact = [null, `#${c.id} (${c.source})`]; }
  }

  try {
    // One round trip, in one transaction: the edit, its audit row and any contact link.
    const update = db.update(members)
      .set({ name: input.name, email: input.email, affiliation: input.affiliation, updatedAt: new Date() })
      .where(eq(members.id, m.id));
    const log = db.insert(adminAudit).values(auditRow(actor, "edit", `Edited #${m.id}`, { memberId: m.id, changes }));
    if (linkContact) await db.batch([update, log, db.update(contacts).set({ memberId: m.id }).where(eq(contacts.id, linkContact))]);
    else await db.batch([update, log]);
  } catch (e) {
    // e.g. the same email was taken a moment ago (unique on lower(email))
    const err = e as { code?: string; message?: string; cause?: { code?: string; message?: string } };
    if ([err?.code, err?.cause?.code].includes("23505") || /unique/i.test(`${err?.message} ${err?.cause?.message}`)) {
      return { ok: false, error: "That email already belongs to another member. Nothing was saved." };
    }
    console.error("member edit failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "The database refused the change. Nothing was saved." };
  }
  updateTag("wall");
  refresh();
  return { ok: true, message: linkContact ? "Saved. The matching contact is now linked to this member." : "Saved." };
}
