import { Suspense } from "react";
import { getAdmin, ROLE_LABELS } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { adminCounts } from "@/lib/contacts-query";
import AdminNav from "./AdminNav";
import { signOut } from "./login/actions";
import styles from "./admin.module.css";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
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
        <span>Signed in as <b>{admin.email ?? "shared password"}</b></span>
        <span className={styles.badge}>{ROLE_LABELS[admin.role]}</span>
        {admin.via === "email" && <form action={signOut}><button type="submit">Sign out</button></form>}
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
      <div><dt>Joined via LinkedIn group</dt><dd>{c.viaLinkedin}</dd></div>
      <div><dt>Contacts</dt><dd>{c.contacts}</dd></div>
      <div><dt>Contacts converted</dt><dd>{c.converted}</dd></div>
      {c.checkedIn !== null && <div><dt>Checked-in contacts</dt><dd>{c.checkedIn}</dd></div>}
    </dl>
  );
}
