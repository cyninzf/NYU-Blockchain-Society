import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import LiveScreen from "@/components/checkin/LiveScreen";
import { getAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { events } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Live", robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// For a screen in the room: the chain animation only, one new node per check-in. Super admins
// only (a session cookie), so the screen's browser signs in once at /admin/login.
export default function LivePage(props: Props) {
  return <Suspense fallback={null}><Live {...props} /></Suspense>;
}

async function Live({ params, searchParams }: Props) {
  const { slug } = await params;
  const { count } = await searchParams;
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
