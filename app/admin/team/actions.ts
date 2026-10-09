"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { auditRow, isSuperAdminEmail, requireAdmin } from "@/lib/admin";
import { adminAudit, ADMIN_ROLES, adminUsers } from "@/lib/db/schema";

export type TeamResult = { ok: true; message: string } | { ok: false; error: string } | null;

const RECOVERY = "That's the recovery super admin (SUPER_ADMIN_EMAIL): it can't be added, changed or removed here.";

/** Add an admin, or bring back a removed one with the chosen role. Super admins only. */
export async function addAdmin(_prev: TeamResult, fd: FormData): Promise<TeamResult> {
  const { db, actor } = await requireAdmin("super_admin");
  const email = z.email().max(254).safeParse(String(fd.get("email") ?? "").trim().toLowerCase());
  const role = z.enum(ADMIN_ROLES).safeParse(fd.get("role"));
  if (!email.success) return { ok: false, error: "Enter a valid email address." };
  if (!role.success) return { ok: false, error: "Pick a role." };
  if (isSuperAdminEmail(email.data)) return { ok: false, error: RECOVERY };
  const [existing] = await db.select().from(adminUsers).where(eq(sql`lower(${adminUsers.email})`, email.data));
  if (existing && !existing.removedAt) return { ok: false, error: `${email.data} is already on the team.` };
  const write = existing
    ? db.update(adminUsers).set({ role: role.data, removedAt: null, addedBy: actor, createdAt: new Date() }).where(eq(adminUsers.id, existing.id))
    : db.insert(adminUsers).values({ email: email.data, role: role.data, addedBy: actor });
  await db.batch([write, db.insert(adminAudit).values(auditRow(actor, "team.add", `Added ${email.data} as ${role.data}`, { changes: { [email.data]: [null, role.data] } }))]);
  refresh();
  return { ok: true, message: `Added ${email.data}. They can sign in at /admin/login.` };
}

async function active(id: number) {
  const { db, actor } = await requireAdmin("super_admin");
  const [u] = await db.select().from(adminUsers).where(and(eq(adminUsers.id, id), isNull(adminUsers.removedAt)));
  if (!u) throw new Error("That admin no longer exists.");
  if (isSuperAdminEmail(u.email)) throw new Error(RECOVERY);
  return { db, actor, u };
}

export async function setAdminRole(fd: FormData) {
  const role = z.enum(ADMIN_ROLES).parse(fd.get("role"));
  const { db, actor, u } = await active(Number(fd.get("id")));
  if (u.role === role) return;
  await db.batch([
    db.update(adminUsers).set({ role }).where(eq(adminUsers.id, u.id)),
    db.insert(adminAudit).values(auditRow(actor, "team.role", `Changed ${u.email} from ${u.role} to ${role}`, { changes: { [u.email]: [u.role, role] } })),
  ]);
  refresh();
}

/** Takes effect at once: every request re-checks admin_users, so their session stops working. */
export async function removeAdmin(fd: FormData) {
  const { db, actor, u } = await active(Number(fd.get("id")));
  if (fd.get("confirm") !== "yes") throw new Error("Not confirmed");
  await db.batch([
    db.update(adminUsers).set({ removedAt: new Date() }).where(eq(adminUsers.id, u.id)),
    db.insert(adminAudit).values(auditRow(actor, "team.remove", `Removed ${u.email} (${u.role})`, { changes: { [u.email]: [u.role, null] } })),
  ]);
  refresh();
}
