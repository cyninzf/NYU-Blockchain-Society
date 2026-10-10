import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import LiveScreen from "@/components/checkin/LiveScreen";
import { getAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { displayAccess } from "@/lib/display-links";

export const metadata: Metadata = { title: "Live", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// For a screen in the room: the chain animation only, one new node per check-in. Opened either
// by a super admin session or by a display link (?d=, made in /admin/events/<id>): that event's
// live screen only, only while check-in is open, until revoked, and it never sets a cookie.
export default function LivePage(props: Props) {
  return <Suspense fallback={null}><Live {...props} /></Suspense>;
}

async function Live({ params, searchParams }: Props) {
  const { slug } = await params;
  const { count, d } = await searchParams;
  if (typeof d === "string" && d) {
    const db = getDb();
    const a = db ? await displayAccess(db, slug, d) : ({ ok: false, reason: "invalid" } as const);
    if (a.ok) return <LiveScreen slug={slug} title={a.title} showCount={count === "1"} displayToken={d} />;
    return (
      <section className="ci">
        <div className="ci-card" data-bg="solid">
          <p className="kicker mono">Live screen</p>
          <h1>{a.reason === "closed" ? "Not live right now" : "This display link doesn't work"}</h1>
          <p className="ci-when">{a.reason === "closed"
            ? "Display links work from 3 hours before the event starts until 2 hours after it ends."
            : "It may have been revoked. Ask an organizer for a new one."}</p>
        </div>
      </section>
    );
  }
  const admin = await getAdmin();
  if (admin?.role !== "super_admin") {
    return (
      <section className="ci">
        <div className="ci-card" data-bg="solid">
          <p className="kicker mono">Live screen</p>
          <h1>Super admins only</h1>
          <p className="ci-when">Sign in on this browser at <a className="ev-link" href="/admin/login">/admin/login</a> with a super admin email, then reopen this page.</p>
        </div>
      </section>
    );
  }
  const db = getDb();
  const [e] = db ? await db.select({ title: events.title }).from(events).where(and(eq(events.slug, slug), eq(events.status, "published"))) : [];
  if (!e) notFound();
  return <LiveScreen slug={slug} title={e.title} showCount={count === "1"} />;
}
