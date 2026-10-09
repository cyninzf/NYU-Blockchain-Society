import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { Suspense } from "react";
import { isSuper, type Admin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { adminAudit, type AdminAudit } from "@/lib/db/schema";
import Guard from "../Guard";
import styles from "../admin.module.css";

export const metadata: Metadata = {
  title: "Audit log · Admin",
  robots: { index: false, follow: false },
};

const SHOWN = 500;

export default function AuditPage() {
  return (
    <>
      <h1>Audit log</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard>{(admin) => <Log admin={admin} />}</Guard>
      </Suspense>
    </>
  );
}

const timeFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
const changesOf = (c: AdminAudit["changes"]) => Object.entries(c).map(([k, [a, b]]) => `${k}: ${a ?? "none"} → ${b ?? "none"}`).join(" · ");

/** Super admins see every admin's actions; admins see only their own. */
async function Log({ admin }: { admin: Admin }) {
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const all = isSuper(admin);
  const rows = await db.select().from(adminAudit).where(all ? undefined : eq(adminAudit.actor, admin.actor)).orderBy(desc(adminAudit.createdAt)).limit(SHOWN);
  return (
    <>
      <p className={styles.lede}>{all ? "Every admin's actions, newest first." : "Your own actions, newest first."} Edits, deletes, imports, exports, sends, approvals, team changes and sign-ins.</p>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="sr">Audit log</caption>
          <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Member</th><th scope="col">Details</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><time dateTime={a.createdAt.toISOString()}>{timeFmt.format(a.createdAt)}</time></td>
                <td>{a.actor}</td>
                <td>{a.action}</td>
                <td>{a.memberId ? `#${a.memberId}` : ""}</td>
                <td>{a.detail}{a.detail && Object.keys(a.changes).length ? " · " : ""}{changesOf(a.changes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className={styles.empty}>Nothing logged yet.</p>}
        {rows.length === SHOWN && <p className={styles.empty}>Showing the latest {SHOWN}.</p>}
      </div>
    </>
  );
}
