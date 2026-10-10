import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eventWhen } from "@/lib/event-time";
import { checkinUrl, qrSvg } from "@/lib/qr";
import PrintButton from "./PrintButton";
import Guard from "../../../Guard";
import styles from "../../../admin.module.css";

export const metadata: Metadata = { title: "Print check-in QR · Admin", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }> };

// A printable sheet for the door: title, date, "Scan to check in" and the QR. Sized to fit both
// A4 and US Letter (the page box is left to the printer; the content stays inside both).
export default function PrintPage({ params }: Props) {
  return <Suspense fallback={null}><Guard min="super_admin">{() => <Sheet params={params} />}</Guard></Suspense>;
}

async function Sheet({ params }: Props) {
  const id = Number((await params).id);
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const [e] = Number.isInteger(id) && id > 0 ? await db.select().from(events).where(eq(events.id, id)) : [];
  if (!e) return <p className={styles.forbidden}>No event #{id}.</p>;
  const url = checkinUrl(e.slug);
  const svg = await qrSvg(url);
  return (
    <>
      <p className={`${styles.row} ${styles.noprint}`}>
        <Link href={`/admin/events/${e.id}`}>Back to the event</Link>
        <PrintButton className={styles.primary} />
      </p>
      <article className={styles.sheet}>
        <p className={styles.sheetBrand}>NYU Blockchain Society</p>
        <h1>{e.title}</h1>
        <p className={styles.sheetWhen}>{eventWhen(e.startsAt, e.endsAt)}{e.venueName ? ` · ${e.venueName}` : ""}</p>
        <div className={styles.sheetQr} dangerouslySetInnerHTML={{ __html: svg }} />
        <p className={styles.sheetCta}>Scan to check in</p>
        <p className={styles.sheetUrl}>{url.replace(/^https?:\/\//, "")}</p>
      </article>
    </>
  );
}
