import type { Metadata } from "next";
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import EventDetail from "@/components/events/EventDetail";
import { getAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { events } from "@/lib/db/schema";

// Admins only: any event, drafts included, exactly as its public page will look, inside the
// site's own layout. Everyone else gets a 404, and it's never indexed.

export const metadata: Metadata = {
  title: "Event preview",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function EventPreviewPage({ searchParams }: Props) {
  return <Suspense fallback={null}><Preview searchParams={searchParams} /></Suspense>;
}

const BANNER: Record<string, string> = {
  draft: "Preview: this draft isn't public yet. Publish it in /admin/events.",
  published: "Preview: this event is published.",
  cancelled: "Preview: this event is cancelled; the public page says so until it would have ended.",
};

async function Preview({ searchParams }: Props) {
  const admin = await getAdmin();
  const db = getDb();
  const id = Number((await searchParams).id);
  if (!admin || !db || !Number.isInteger(id) || id < 1) notFound();
  const [row] = await db.select({ e: events, over: sql<boolean>`coalesce(${events.endsAt}, ${events.startsAt}) <= now()` }).from(events).where(eq(events.id, id));
  if (!row) notFound();
  return <EventDetail event={row.e} over={row.over} banner={<p className="ev-banner mono" role="note">{BANNER[row.e.status]}</p>} />;
}
