import type { Metadata } from "next";
import { Suspense } from "react";
import { desc, eq } from "drizzle-orm";
import { isPrivacyTopic, TOPIC_LABELS } from "@/content/contact";
import { isSuper, type Admin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { CONTACT_STATUSES, contactMessages, type ContactMessage, type ContactStatus } from "@/lib/db/schema";
import Guard from "../../Guard";
import styles from "../../admin.module.css";
import InquiryTabs from "../InquiryTabs";
import { changeContactStatus, removeContactMessage } from "./actions";

export const metadata: Metadata = { title: "Contact messages · Admin", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function ContactMessagesPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <h1>Inquiries</h1>
      <InquiryTabs current="contact" />
      <p className={styles.lede}>Messages from /contact. Each one also went by email to the recovery super admin, with Reply going to the sender; privacy requests also sent the sender one confirmation link. Those emails count toward the shared daily email limit. Act on a privacy request (access or delete) only once it shows Verified.</p>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard>{(admin) => <Messages admin={admin} searchParams={searchParams} />}</Guard>
      </Suspense>
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
const LABEL: Record<ContactStatus, string> = { new: "New", replied: "Replied", closed: "Closed" };

const verified = (m: ContactMessage) =>
  !isPrivacyTopic(m.topic) ? <span className={styles.note}>Not needed</span>
  : m.verifiedAt ? <span className={styles.badge}>Verified<span className="sr"> {dateFmt.format(m.verifiedAt)}</span></span>
  : <span className={styles.badge}>Unverified</span>;

async function Messages({ admin, searchParams }: { admin: Admin; searchParams: SP }) {
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const sp = await searchParams;
  const status = CONTACT_STATUSES.find((s) => s === sp.status);
  const rows = await db.select().from(contactMessages).where(status ? eq(contactMessages.status, status) : undefined).orderBy(desc(contactMessages.id)).limit(300);
  return (
    <>
      <form className={styles.filters} method="get">
        <label>Status
          <select name="status" defaultValue={status ?? ""}>
            <option value="">Any</option>
            {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
          </select>
        </label>
        <button type="submit">Filter</button>
        {!isSuper(admin) && <span className={styles.note}>Read-only: super admins change the status and delete.</span>}
      </form>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="sr">Contact messages, newest first</caption>
          <thead><tr><th scope="col">Received (ET)</th><th scope="col">From</th><th scope="col">Topic</th><th scope="col">Verified</th><th scope="col">Message</th><th scope="col">Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{dateFmt.format(r.createdAt)}<div className={styles.note}>#{r.id}</div></td>
                <td>{r.name}<div><a href={`mailto:${r.email}`}>{r.email}</a></div></td>
                <td>{TOPIC_LABELS[r.topic]}</td>
                <td>{verified(r)}{r.verifiedAt && <div className={styles.note}>{dateFmt.format(r.verifiedAt)}</div>}</td>
                <td style={{ whiteSpace: "pre-line", maxWidth: 420 }}>{r.message}</td>
                <td>
                  {isSuper(admin) ? (
                    <form action={changeContactStatus} className={styles.row}>
                      <input type="hidden" name="id" value={r.id} />
                      <select name="status" defaultValue={r.status} aria-label={`Status of contact message ${r.id}`}>
                        {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                      </select>
                      <button type="submit">Save</button>
                    </form>
                  ) : <span className={styles.badge}>{LABEL[r.status]}</span>}
                  {isSuper(admin) && (
                    <details className={styles.del}>
                      <summary>Delete</summary>
                      <form action={removeContactMessage}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="confirm" value="yes" />
                        <button type="submit">Delete #{r.id} permanently</button>
                      </form>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className={styles.empty}>No messages{status ? ` marked ${LABEL[status].toLowerCase()}` : " yet"}.</p>}
      </div>
    </>
  );
}
