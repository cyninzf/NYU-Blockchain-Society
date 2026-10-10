import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { forbidden, unstable_rethrow } from "next/navigation";
import { getDb, type Db } from "./db";
import { adminAudit, adminUsers, type AdminRole, type AuditChanges } from "./db/schema";
import { ADMIN_COOKIE } from "./session-token";
import { sessionSubject } from "./sessions";

import { reportError } from "./monitoring";
// Who is acting in /admin, and what they may do. Checked on the server in every admin page,
// action and route (proxy.ts only keeps strangers out): hiding a button is never the guard.

export type Admin = {
  email: string;
  role: AdminRole;
  /** What admin_audit records: the admin's email. (Rows from before round 10 may read "basic:<user>".) */
  actor: string;
};

export const ROLE_LABELS: Record<AdminRole, string> = { super_admin: "Super admin", admin: "Admin" };

const norm = (e: string) => e.trim().toLowerCase();
/** The recovery key: always a super admin, never stored in admin_users. */
export const superAdminEmail = () => (process.env.SUPER_ADMIN_EMAIL ? norm(process.env.SUPER_ADMIN_EMAIL) : null);
export const isSuperAdminEmail = (email: string) => superAdminEmail() === norm(email);

/** The role an email signs in with, or null. A broken admin_users table never locks out SUPER_ADMIN_EMAIL. */
export async function roleFor(db: Db | null, email: string): Promise<AdminRole | null> {
  if (isSuperAdminEmail(email)) return "super_admin";
  if (!db) return null;
  try {
    const [u] = await db.select({ role: adminUsers.role }).from(adminUsers)
      .where(and(eq(sql`lower(${adminUsers.email})`, norm(email)), isNull(adminUsers.removedAt)));
    return u?.role ?? null;
  } catch (e) {
    unstable_rethrow(e);
    reportError("admin", "admin_users lookup failed", e);
    return null;
  }
}

/** The signed-in admin (a live magic-link session), or null. There is no other way in. */
export async function getAdmin(): Promise<Admin | null> {
  const db = getDb();
  // A live server-side session (not signed out or revoked), and the role re-checked on every
  // request, so removing an admin or changing a role applies at once.
  const email = await sessionSubject(db, "admin", (await cookies()).get(ADMIN_COOKIE)?.value);
  if (email) {
    const role = await roleFor(db, email);
    if (role) return { email, role, actor: email };
  }
  return null;
}

export const isSuper = (a: Admin | null) => a?.role === "super_admin";

/** For admin actions and routes: throws unless signed in with at least `min`. */
export async function requireAdmin(min: AdminRole = "admin"): Promise<{ db: Db; admin: Admin; actor: string }> {
  const admin = await getAdmin();
  if (!admin) throw new Error("Unauthorized");
  if (min === "super_admin" && admin.role !== "super_admin") throw new Error("Super admins only");
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");
  return { db, admin, actor: admin.actor };
}

/**
 * For super-admin-only actions where an admin might try anyway (events): an admin is refused
 * with a 403 and the attempt is logged as "denied" (they see it in their own audit log).
 */
export async function requireSuperOr403(attempt: string): Promise<{ db: Db; admin: Admin; actor: string }> {
  const { db, admin, actor } = await requireAdmin();
  if (admin.role !== "super_admin") {
    await audit(db, actor, "denied", `Refused (super admins only): ${attempt}`).catch((e) => reportError("admin", "audit failed", e));
    forbidden();
  }
  return { db, admin, actor };
}

/** One admin_audit row for an action that isn't a member edit (or a member edit's own row). */
export function auditRow(actor: string, action: string, detail: string, opts: { memberId?: number | null; changes?: AuditChanges } = {}) {
  return { actor, action, detail, memberId: opts.memberId ?? null, changes: opts.changes ?? {} };
}

export async function audit(db: Db, actor: string, action: string, detail: string, opts: { memberId?: number | null; changes?: AuditChanges } = {}) {
  await db.insert(adminAudit).values(auditRow(actor, action, detail, opts));
}

/** For route handlers (exports): the admin, or the error Response to return. */
export async function adminForRoute(min: AdminRole = "admin"): Promise<{ db: Db; actor: string } | Response> {
  try {
    const { db, actor } = await requireAdmin(min);
    return { db, actor };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return new Response(msg === "DATABASE_URL is not set" ? `${msg} for this environment.` : msg, {
      status: msg === "Unauthorized" ? 401 : msg === "Super admins only" ? 403 : 503,
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    });
  }
}

/** "country=Portugal, block=ai" for audit details (filters, never personal data). */
export const describeFilters = (f: Record<string, unknown>) =>
  Object.entries(f).filter(([, v]) => v !== undefined && v !== "" && v !== null).map(([k, v]) => `${k}=${String(v)}`).join(", ") || "none";
