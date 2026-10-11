import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { getSetting, postalAddress } from "@/lib/settings";
import { superAdminEmail } from "@/lib/admin";
import { maskEmail } from "@/lib/contacts-import";
import AddressForm from "./AddressForm";
import TestEmails from "./TestEmails";
import DigestForm from "./DigestForm";
import Guard from "../Guard";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Settings · Admin", robots: { index: false, follow: false } };

export default function SettingsPage() {
  return (
    <>
      <h1>Settings</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard min="super_admin">{() => <Settings />}</Guard>
      </Suspense>
    </>
  );
}

async function Settings() {
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  return (
    <>
      <AddressForm value={(await postalAddress(db)) ?? ""} />
      <DigestForm value={(await getSetting(db, "digest_recipients")) ?? ""} superEmail={superAdminEmail() ? maskEmail(superAdminEmail()!) : null} />
      <TestEmails />
      <p className={styles.note}>Error monitoring: <Link href="/admin/sentry-test">send a Sentry test error</Link>.</p>
    </>
  );
}
