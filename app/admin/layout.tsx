import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { adminCounts } from "@/lib/contacts-query";
import AdminNav from "./AdminNav";
import styles from "./admin.module.css";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <AdminNav />
        <Suspense fallback={null}><Counts /></Suspense>
      </header>
      {children}
    </main>
  );
}

async function Counts() {
  await connection();
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
