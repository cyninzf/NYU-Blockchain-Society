import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { organizerSource } from "@/lib/contact-save";
import { displayNameFor } from "@/lib/admin-profiles";
import { listSources } from "@/lib/contacts-query";
import { getDb } from "@/lib/db";
import Guard from "../../Guard";
import styles from "../../admin.module.css";
import QuickAdd from "./QuickAdd";

export const metadata: Metadata = { title: "Add a contact · Admin", robots: { index: false, follow: false } };

// Round 28: both roles. The source defaults to the signed-in organizer's own introductions:
// via-<display name> (round 28.1, set on /admin/team), else via-<email name>.
export default function NewContactPage() {
  return (
    <>
      <h1>Add a contact</h1>
      <p><Link href="/admin/contacts">Back to contacts</Link></p>
      <p className={styles.lede}>One person you know or were introduced to, e.g. an investor. Email is optional (some people are LinkedIn-only). If they&apos;re already a contact (same email or LinkedIn URL) you&apos;ll see them first and can add a note and fill empty fields instead. This creates a contact only: no member and no email. A source starting &ldquo;via-&rdquo; is a personal introduction, never in a bulk invite unless a super admin explicitly includes it.</p>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard>{(admin) => <Form email={admin.email} />}</Guard>
      </Suspense>
    </>
  );
}

async function Form({ email }: { email: string }) {
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const [name, sources] = await Promise.all([displayNameFor(db, email), listSources(db)]);
  return (
    <>
      {!name && <p className={styles.note}>No display name is set for you, so the source defaults to your email name. A super admin can set one in Team (e.g. Fang → via-fang).</p>}
      <QuickAdd defaultSource={organizerSource(email, name)} sources={sources} />
    </>
  );
}
