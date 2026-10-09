import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { isAdminAuthorized } from "./admin-auth";
import { getDb, type Db } from "./db";
import { adminAudit, adminUsers, type AdminRole, type AuditChanges } from "./db/schema";
import { ADMIN_COOKIE, readSession } from "./session-token";

// Who is acting in /admin, and what they may do. Checked on the server in every admin page,
// action and route (proxy.ts only keeps strangers out): hiding a button is never the guard.

export type Admin = {
  /** Null under the shared-password fallback. */
  email: string | null;
  role: AdminRole;
  /** What admin_audit records: the email, or "basic:<user>" under the fallback. */
  actor: string;
  via: "email" | "basic";
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
    console.error("admin_users lookup failed", e instanceof Error ? e.message : e);
    return null;
  }
}

/** The signed-in admin (session cookie first, then the basic-auth fallback), or null. */
export async function getAdmin(): Promise<Admin | null> {
  const session = readSession("admin", (await cookies()).get(ADMIN_COOKIE)?.value);
  if (session) {
    // Re-checked on every request, so removing an admin or changing a role applies at once.
    const role = await roleFor(getDb(), session.subject);
    if (role) return { email: session.subject, role, actor: session.subject, via: "email" };
  }
  const auth = (await headers()).get("authorization");
  if (isAdminAuthorized(auth)) {
    // Shared password: the fallback until everyone signs in with their own email.
    const decoded = atob(auth!.slice(6));
    return { email: null, role: "super_admin", actor: `basic:${decoded.slice(0, decoded.indexOf(":"))}`, via: "basic" };
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
