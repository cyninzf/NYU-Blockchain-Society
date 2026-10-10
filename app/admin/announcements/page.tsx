import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { Suspense } from "react";
import { describeFilters } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { AFFILIATIONS, announcements } from "@/lib/db/schema";
import { AFFILIATION_LABELS, membersByCountry } from "@/lib/members-query";
import Guard from "../Guard";
import Composer from "./Composer";
import styles from "../admin.module.css";

export const metadata: Metadata = {
  title: "Announcements · Admin",
  robots: { index: false, follow: false },
};

export default function AnnouncementsPage() {
  return (
    <>
      <h1>Announcements</h1>
      <p className={styles.lede}>Write a plain email to members, pick who gets it, send yourself a test, then send. Unsubscribed members are always left out. Resend&apos;s free plan allows 100 emails a day, counting welcome emails and sign-in links.</p>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard>{() => <Announcements />}</Guard>
      </Suspense>
    </>
  );
}

const timeFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });

async function Announcements() {
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const [log, countries] = await Promise.all([
    db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(50),
    membersByCountry(db),
  ]);
  return (
    <>
      <Composer
        affiliations={AFFILIATIONS.map((a) => [a, AFFILIATION_LABELS[a]])}
        countries={countries.flatMap((c) => (c.country ? [c.country] : []))}
      />
      <h2 className={styles.h2}>Log</h2>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="sr">Announcements and tests, newest first</caption>
          <thead><tr><th scope="col">When</th><th scope="col">Status</th><th scope="col">Subject</th><th scope="col">Sent</th><th scope="col">Filters</th><th scope="col">By</th></tr></thead>
          <tbody>
            {log.map((a) => (
              <tr key={a.id}>
                <td><time dateTime={a.createdAt.toISOString()}>{timeFmt.format(a.createdAt)}</time></td>
                <td>{a.status}</td>
                <td>{a.subject}</td>
                <td>{a.status === "test" ? "test to self" : `${a.sentCount} of ${a.recipientCount}`}</td>
                <td>{a.status === "test" ? "" : describeFilters(a.filters)}</td>
                <td>{a.sentBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!log.length && <p className={styles.empty}>Nothing sent yet.</p>}
      </div>
    </>
  );
}
