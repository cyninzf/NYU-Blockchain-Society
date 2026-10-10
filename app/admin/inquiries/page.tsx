import type { Metadata } from "next";
import { Suspense } from "react";
import { desc, eq } from "drizzle-orm";
import { isSuper, type Admin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { conferenceInquiries, INQUIRY_STATUSES, type InquiryStatus } from "@/lib/db/schema";
import { INTEREST_LABELS } from "@/lib/inquiries";
import { changeInquiryStatus } from "./actions";
import Guard from "../Guard";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Inquiries · Admin", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function InquiriesPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <h1>Inquiries</h1>
      <p className={styles.lede}>Sponsor and speaker inquiries from /conference. Each one also went by email to the recovery super admin, with Reply going to the inquirer. Inquirers aren&apos;t contacts or members unless they join themselves.</p>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard>{(admin) => <Inquiries admin={admin} searchParams={searchParams} />}</Guard>
      </Suspense>
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
const LABEL: Record<InquiryStatus, string> = { new: "New", replied: "Replied", closed: "Closed" };

async function Inquiries({ admin, searchParams }: { admin: Admin; searchParams: SP }) {
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const sp = await searchParams;
  const status = INQUIRY_STATUSES.find((s) => s === sp.status);
  const rows = await db.select().from(conferenceInquiries).where(status ? eq(conferenceInquiries.status, status) : undefined).orderBy(desc(conferenceInquiries.id)).limit(300);
  return (
    <>
      <form className={styles.filters} method="get">
        <label>Status
          <select name="status" defaultValue={status ?? ""}>
            <option value="">Any</option>
            {INQUIRY_STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
          </select>
        </label>
        <button type="submit">Filter</button>
        {!isSuper(admin) && <span className={styles.note}>Read-only: super admins change the status.</span>}
      </form>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="sr">Conference inquiries, newest first</caption>
          <thead><tr><th scope="col">Received (ET)</th><th scope="col">From</th><th scope="col">Interest</th><th scope="col">Message</th><th scope="col">Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{dateFmt.format(r.createdAt)}<div className={styles.note}>#{r.id} · {r.edition}</div></td>
                <td>{r.name}<div><a href={`mailto:${r.email}`}>{r.email}</a></div>{r.company && <div className={styles.note}>{r.company}</div>}</td>
                <td>{INTEREST_LABELS[r.interest]}</td>
                <td style={{ whiteSpace: "pre-line", maxWidth: 420 }}>{r.message}</td>
                <td>
                  {isSuper(admin) ? (
                    <form action={changeInquiryStatus} className={styles.row}>
                      <input type="hidden" name="id" value={r.id} />
                      <select name="status" defaultValue={r.status} aria-label={`Status of inquiry ${r.id}`}>
                        {INQUIRY_STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                      </select>
                      <button type="submit">Save</button>
                    </form>
                  ) : <span className={styles.badge}>{LABEL[r.status]}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className={styles.empty}>No inquiries{status ? ` marked ${LABEL[status].toLowerCase()}` : " yet"}.</p>}
      </div>
    </>
  );
}
