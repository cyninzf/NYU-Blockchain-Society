import type { Metadata } from "next";
import { desc, isNull } from "drizzle-orm";
import { Suspense } from "react";
import { ROLE_LABELS, superAdminEmail } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { maskEmail } from "@/lib/contacts-import";
import Guard from "../Guard";
import AddAdmin from "./AddAdmin";
import { removeAdmin, setAdminRole } from "./actions";
import styles from "../admin.module.css";

export const metadata: Metadata = {
  title: "Team · Admin",
  robots: { index: false, follow: false },
};

export default function TeamPage() {
  return (
    <>
      <h1>Team</h1>
      <p className={styles.lede}>Who can sign in to the admin. Admins can view and edit members, link contacts and send announcements. Only super admins can manage events, import, export, delete, manage the team or change settings. Every change here is in the audit log.</p>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard min="super_admin">{() => <Team />}</Guard>
      </Suspense>
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" });

async function Team() {
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const rows = await db.select().from(adminUsers).where(isNull(adminUsers.removedAt)).orderBy(desc(adminUsers.createdAt));
  const recovery = superAdminEmail();
  return (
    <>
      <AddAdmin />
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="sr">Admins</caption>
          <thead><tr><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Added</th><th scope="col"><span className="sr">Actions</span></th></tr></thead>
          <tbody>
            {recovery && (
              <tr>
                <td>{maskEmail(recovery)}</td>
                <td>{ROLE_LABELS.super_admin}</td>
                <td>Recovery key (set in Vercel as SUPER_ADMIN_EMAIL)</td>
                <td>Always a super admin: can&apos;t be changed or removed.</td>
              </tr>
            )}
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>
                  <form className={styles.row} action={setAdminRole}>
                    <input type="hidden" name="id" value={u.id} />
                    <select name="role" defaultValue={u.role} aria-label={`Role for ${u.email}`}>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super admin</option>
                    </select>
                    <button type="submit">Save</button>
                  </form>
                </td>
                <td>{dateFmt.format(u.createdAt)} by {u.addedBy}</td>
                <td>
                  <details className={styles.del}>
                    <summary>Remove</summary>
                    <form action={removeAdmin}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="confirm" value="yes" />
                      <button type="submit">Remove {u.email}</button>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className={styles.empty}>No other admins yet. Add the organizers above.</p>}
      </div>
    </>
  );
}
