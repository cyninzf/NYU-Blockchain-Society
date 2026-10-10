import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { isSuper, type Admin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { dateToNyInput } from "@/lib/event-time";
import EventForm from "../EventForm";
import ShareLink from "../ShareLink";
import StatusActions, { STATUS_LABELS } from "../StatusActions";
import Checkins from "./Checkins";
import DisplayLinks from "./DisplayLinks";
import { checkinUrl, qrSvg } from "@/lib/qr";
import Guard from "../../Guard";
import styles from "../../admin.module.css";

import { eventPath, NETWORKING_PATH } from "@/lib/event-fields";
export const metadata: Metadata = {
  title: "Edit event · Admin",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function EditEventPage(props: Props) {
  return (
    <>
      <h1>Event</h1>
      <p><Link href="/admin/events">Back to events</Link></p>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard>{(admin) => <Edit {...props} admin={admin} />}</Guard>
      </Suspense>
    </>
  );
}

async function Edit({ params, searchParams, admin }: Props & { admin: Admin }) {
  const id = Number((await params).id);
  const { created, q } = await searchParams;
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const [e] = Number.isInteger(id) && id > 0 ? await db.select().from(events).where(eq(events.id, id)) : [];
  if (!e) return <p className={styles.forbidden}>No event #{(await params).id}. It may have been deleted.</p>;
  return (
    <>
      {created === "1" && <p className={styles.note} role="status">Draft created. Preview it, then publish when it&apos;s ready.</p>}
      <div className={styles.row}>
        <span className={styles.badge}>{STATUS_LABELS[e.status]}</span>
        <a href={`${NETWORKING_PATH}/preview?id=${e.id}`} target="_blank" rel="noopener">Preview as it will appear</a>
        {e.status !== "draft" && <a href={eventPath(e.slug)} target="_blank" rel="noopener">Public page</a>}
      </div>
      {e.status === "published" && (
        <section className={styles.mix} aria-labelledby="share-h">
          <h2 id="share-h">Share link <span>Use it in invites: joins that start from it are stored with source <code>event-{e.slug}</code>.</span></h2>
          <ShareLink slug={e.slug} />
        </section>
      )}
      {isSuper(admin)
        ? <StatusActions id={e.id} status={e.status} from="edit" />
        : <p className={styles.note}>View only: only super admins can edit, publish, cancel or delete events.</p>}
      {isSuper(admin) && e.status === "published" && (
        <section className={styles.mix} aria-labelledby="qr-h">
          <h2 id="qr-h">Check-in QR <span>Points to {checkinUrl(e.slug)}. Check-in opens 3 hours before the start and closes 2 hours after the end.</span></h2>
          <div className={styles.qr}>
            <div dangerouslySetInnerHTML={{ __html: await qrSvg(checkinUrl(e.slug)) }} />
            <div className={styles.row}>
              <a href={`/admin/events/${e.id}/qr.png`} download>Download PNG</a>
              <a href={`/admin/events/${e.id}/qr.svg`} download>Download SVG</a>
              <Link href={`/admin/events/${e.id}/print`}>Printable page (A4 / Letter)</Link>
            </div>
          </div>
        </section>
      )}
      {isSuper(admin) && e.status === "published" && <DisplayLinks db={db} eventId={e.id} slug={e.slug} />}
      {isSuper(admin) && (
        <section className={styles.mix} aria-labelledby="test-h">
          <h2 id="test-h">Test mode <span>Try check-in and the live screen on any event, drafts included, at any time. Test check-ins are marked, never counted, and listed apart below; the test join form creates nothing unless you tick &ldquo;Create a real member&rdquo;.</span></h2>
          <p className={styles.row}>
            <a href={`${eventPath(e.slug)}/checkin?test=1`} target="_blank" rel="noopener">Check-in (test mode)</a>
            <a href={`${eventPath(e.slug)}/live?test=1&count=1`} target="_blank" rel="noopener">Live screen (test mode)</a>
          </p>
        </section>
      )}
      <Checkins db={db} eventId={e.id} admin={admin} q={typeof q === "string" ? q.trim().slice(0, 80) : ""} showReal={e.status !== "draft"} />
      <EventForm
        readOnly={!isSuper(admin)}
        key={e.updatedAt.toISOString()}
        e={{
          id: e.id, title: e.title, kind: e.kind ?? "", slug: e.slug, startsAt: dateToNyInput(e.startsAt), endsAt: e.endsAt ? dateToNyInput(e.endsAt) : "",
          venueName: e.venueName ?? "", address: e.address ?? "", description: e.description ?? "", registrationUrl: e.registrationUrl ?? "", cohost: e.cohost ?? "",
        }}
      />
    </>
  );
}
