import { connection } from "next/server";
import { Suspense } from "react";
import { getAdmin, ROLE_LABELS } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { adminCounts } from "@/lib/contacts-query";
import AdminNav from "./AdminNav";
import { signOut } from "./login/actions";
import styles from "./admin.module.css";

// Every /admin route renders per request, never prerendered (round 18): with Cache Components and
// Partial Prefetching, a prerender pass (a prefetch, or the re-render after a server action) could
// start the session lookup and have its database fetch cut off when the prerender ended. So no
// static shell (`instant = false`), no prefetching of admin segments, and `connection()` first:
// nothing below runs until there is a real request.
export const instant = false;
export const prefetch = "force-disabled";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await connection();
  return (
    <main className={styles.page}>
      <Suspense fallback={null}><Header /></Suspense>
      {children}
    </main>
  );
}

/** Nothing on the sign-in pages: the header appears once someone is signed in. */
async function Header() {
  const admin = await getAdmin();
  if (!admin) return null;
  return (
    <header className={styles.head}>
      <AdminNav role={admin.role} />
      <div className={styles.who}>
        <span>Signed in as <b>{admin.email}</b></span>
        <span className={styles.badge}>{ROLE_LABELS[admin.role]}</span>
        <form action={signOut}><button type="submit">Sign out</button></form>
      </div>
      <Counts />
    </header>
  );
}

async function Counts() {
  const db = getDb();
  if (!db) return null;
  const c = await adminCounts(db);
  return (
    <dl className={styles.counts}>
      <div><dt>Members</dt><dd>{c.members}</dd></div>
      <div><dt>Contacts</dt><dd>{c.contacts}</dd></div>
      <div><dt>Contacts converted</dt><dd>{c.converted}</dd></div>
      {c.checkedIn !== null && <div><dt>Checked-in contacts</dt><dd>{c.checkedIn}</dd></div>}
    </dl>
  );
}
