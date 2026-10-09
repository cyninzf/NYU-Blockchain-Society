import type { ReactNode } from "react";
import { getAdmin, type Admin } from "@/lib/admin";
import type { AdminRole } from "@/lib/db/schema";
import styles from "./admin.module.css";

/**
 * Server-side page guard: renders `children(admin)` only for a signed-in admin with at least
 * `min`. Pages use it inside <Suspense> (it reads cookies). Actions and routes check on their own.
 */
export default async function Guard({ min = "admin", children }: { min?: AdminRole; children: (admin: Admin) => ReactNode }) {
  const admin = await getAdmin();
  if (!admin) return <p className={styles.forbidden}>Sign in to continue. <a href="/admin/login">Admin sign-in</a></p>;
  if (min === "super_admin" && admin.role !== "super_admin") return <p className={styles.forbidden}>Only super admins can open this page.</p>;
  return children(admin);
}
