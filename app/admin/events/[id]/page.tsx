import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { isSuper, type Admin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { dateToNyInput } from "@/lib/event-time";
import EventForm from "../EventForm";
import StatusActions, { STATUS_LABELS } from "../StatusActions";
import Guard from "../../Guard";
import styles from "../../admin.module.css";

export const metadata: Metadata = {
  title: "Edit event · Admin",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function EditEventPage(props: Props) {
  return (
    <>
      <h1>Edit event</h1>
      <p><Link href="/admin/events">Back to events</Link></p>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard>{(admin) => <Edit {...props} admin={admin} />}</Guard>
      </Suspense>
    </>
  );
}

async function Edit({ params, searchParams, admin }: Props & { admin: Admin }) {
  const id = Number((await params).id);
  const { created } = await searchParams;
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const [e] = Number.isInteger(id) && id > 0 ? await db.select().from(events).where(eq(events.id, id)) : [];
  if (!e) return <p className={styles.forbidden}>No event #{(await params).id}. It may have been deleted.</p>;
  return (
    <>
      {created === "1" && <p className={styles.note} role="status">Draft created. Preview it, then publish when it&apos;s ready.</p>}
      <div className={styles.row}>
        <span className={styles.badge}>{STATUS_LABELS[e.status]}</span>
        <a href={`/events/preview?id=${e.id}`} target="_blank" rel="noopener">Preview as it will appear</a>
        {e.status !== "draft" && <a href={`/events/${e.slug}`} target="_blank" rel="noopener">Public page</a>}
      </div>
      <StatusActions id={e.id} status={e.status} canDelete={isSuper(admin)} from="edit" />
      <EventForm
        key={e.updatedAt.toISOString()}
        e={{
          id: e.id, title: e.title, slug: e.slug, startsAt: dateToNyInput(e.startsAt), endsAt: e.endsAt ? dateToNyInput(e.endsAt) : "",
          venueName: e.venueName ?? "", address: e.address ?? "", description: e.description ?? "", registrationUrl: e.registrationUrl ?? "", cohost: e.cohost ?? "",
        }}
      />
    </>
  );
}
