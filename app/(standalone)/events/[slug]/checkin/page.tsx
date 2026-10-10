import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import CheckinDone from "@/components/checkin/CheckinDone";
import CheckinFlow, { CheckinSelf } from "@/components/checkin/CheckinFlow";
import CheckinShell from "@/components/checkin/CheckinShell";
import { countIsPublic } from "@/lib/chain-stats";
import { CLOSES_AFTER_H, checkinEvent, isCheckedIn, OPENS_BEFORE_H } from "@/lib/checkin";
import { getDb } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eventWhen } from "@/lib/event-time";
import { memberIdFromSession } from "@/lib/member-session";

export const metadata: Metadata = { title: "Check in", robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function CheckinPage(props: Props) {
  return <Suspense fallback={null}><Checkin {...props} /></Suspense>;
}

async function Checkin({ params, searchParams }: Props) {
  const { slug } = await params;
  const { error } = await searchParams;
  const db = getDb();
  if (!db) return <p className="ci-local">DATABASE_URL isn&apos;t set, so check-in can&apos;t run here. It works on Vercel deployments.</p>;
  // Published events only: drafts, cancelled and unknown slugs are a 404.
  const e = await checkinEvent(db, slug);
  if (!e) notFound();

  if (e.window !== "open") {
    return (
      <CheckinShell e={e}>
        <div className="ci-step">
          <h2>Check-in isn&apos;t open</h2>
          <p>{e.window === "before"
            ? <>It opens {OPENS_BEFORE_H} hours before the start ({eventWhen(e.startsAt, e.endsAt)}). See you there.</>
            : <>Check-in closed {CLOSES_AFTER_H} hours after the event. Thanks for coming.</>}</p>
          <p><a className="ev-link" href={`/events/${e.slug}`}>Event details</a></p>
        </div>
      </CheckinShell>
    );
  }

  const memberId = await memberIdFromSession();
  if (memberId) {
    const [m] = await db.select({ name: members.name }).from(members).where(eq(members.id, memberId));
    if (m) {
      if (await isCheckedIn(db, e.id, memberId)) return <CheckinShell e={e}><CheckinDone n={(await countIsPublic(db)) ? memberId : null} /></CheckinShell>;
      return <CheckinShell e={e}><CheckinSelf slug={e.slug} firstName={m.name.trim().split(/\s+/)[0]} /></CheckinShell>;
    }
  }
  return (
    <CheckinShell e={e}>
      {error === "link" && <p className="ci-err" role="alert">That check-in link has expired or was already used. Enter your email for a new one.</p>}
      <CheckinFlow slug={e.slug} />
    </CheckinShell>
  );
}
