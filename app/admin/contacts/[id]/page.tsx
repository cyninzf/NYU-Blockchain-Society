import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { contacts, members } from "@/lib/db/schema";
import { linkedInterest } from "@/lib/contact-save";
import Guard from "../../Guard";
import styles from "../../admin.module.css";
import EditContact from "./EditContact";

export const metadata: Metadata = { title: "Edit contact · Admin", robots: { index: false, follow: false } };

// Round 28.1: both roles. Name, email and source aren't edited here (imports and quick-add own them).
export default function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <p><Link href="/admin/contacts">Back to contacts</Link></p>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard>{() => <Contact params={params} />}</Guard>
      </Suspense>
    </>
  );
}

async function Contact({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const [row] = await db.select({ c: contacts, memberName: members.name }).from(contacts).leftJoin(members, eq(members.id, contacts.memberId)).where(eq(contacts.id, id));
  if (!row) notFound();
  const { c } = row;
  const acc = (await linkedInterest(db, [id])).get(id) ?? [];
  return (
    <>
      <h1>{c.name ?? "Contact"} <span className={styles.note}>#{c.id}</span></h1>
      <p className={styles.lede}>
        {c.email ?? "No email"} · source <code>{c.source}</code>
        {c.memberId ? <> · member #{c.memberId}{row.memberName ? ` (${row.memberName})` : ""}</> : null}
        {acc.length > 0 && <> · accelerator {acc.map((a, i) => <span key={a.id}>{i ? ", " : ""}<Link href={`/admin/inquiries/accelerator?type=${a.type}`}>#{a.id} ({a.type})</Link></span>)}</>}
      </p>
      <p className={styles.note}>Organizer-only. Changes here are deliberate edits: the relationship can move either way. Every change is in the audit log with old → new; a note is added as a dated line and moves the last touch.</p>
      <EditContact c={{
        id: c.id, company: c.company, headline: c.headline, linkedinUrl: c.linkedinUrl, contactType: c.contactType, focus: c.focus,
        stage: c.stage, nyuAlum: c.nyuAlum, relationship: c.relationship, notes: c.notes, lastTouchAt: c.lastTouchAt,
      }} />
    </>
  );
}
