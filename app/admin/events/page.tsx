import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { asc, sql } from "drizzle-orm";
import { isSuper, type Admin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { events, type EventRow } from "@/lib/db/schema";
import { eventWhen } from "@/lib/event-time";
import StatusActions, { STATUS_LABELS } from "./StatusActions";
import Guard from "../Guard";
import styles from "../admin.module.css";

export const metadata: Metadata = {
  title: "Events · Admin",
  robots: { index: false, follow: false },
};

export default function EventsPage() {
  return (
    <>
      <h1>Events</h1>
      <p className={styles.lede}>Networking events for the site: the next published one shows in Block 01 on the home page, and every published event gets a page under /events. New events start as drafts, which are never public; preview one before publishing. Times are New York time.</p>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard>{(admin) => <Events admin={admin} />}</Guard>
      </Suspense>
    </>
  );
}

async function Events({ admin }: { admin: Admin }) {
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  // Upcoming until it ends (or, without an end, until it starts): the same rule as the site.
  const rows = await db.select({ e: events, over: sql<boolean>`coalesce(${events.endsAt}, ${events.startsAt}) <= now()` }).from(events).orderBy(asc(events.startsAt));
  const upcoming = rows.filter((r) => !r.over).map((r) => r.e);
  const past = rows.filter((r) => r.over).map((r) => r.e).reverse();
  return (
    <>
      <p className={styles.row}><Link className={`${styles.button} ${styles.primary}`} href="/admin/events/new">New event</Link></p>
      <List title="Upcoming" rows={upcoming} admin={admin} empty="No upcoming events. Block 01 shows “Next date soon”." />
      <List title="Past" rows={past} admin={admin} empty="No past events yet." />
    </>
  );
}

function List({ title, rows, admin, empty }: { title: string; rows: EventRow[]; admin: Admin; empty: string }) {
  return (
    <section className={styles.mix} aria-label={title}>
      <h2>{title} ({rows.length})</h2>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr><th scope="col">When (ET)</th><th scope="col">Event</th><th scope="col">Status</th><th scope="col"><span className="sr">Actions</span></th></tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>{eventWhen(e.startsAt, e.endsAt)}</td>
                <td>
                  <b>{e.title}</b>
                  {e.venueName && <div>{e.venueName}</div>}
                  {e.cohost && <div className={styles.note}>Co-hosted with {e.cohost}</div>}
                </td>
                <td><span className={styles.badge}>{STATUS_LABELS[e.status]}</span></td>
                <td>
                  <div className={styles.row}>
                    <Link href={`/admin/events/${e.id}`}>Edit</Link>
                    <a href={`/events/preview?id=${e.id}`} target="_blank" rel="noopener">Preview</a>
                    {e.status !== "draft" && <a href={`/events/${e.slug}`} target="_blank" rel="noopener">Public page</a>}
                  </div>
                  <StatusActions id={e.id} status={e.status} canDelete={isSuper(admin)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className={styles.empty}>{empty}</p>}
      </div>
    </section>
  );
}
