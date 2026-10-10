import { and, count, eq } from "drizzle-orm";
import { adminForRoute } from "@/lib/admin";
import { eventCheckins, events } from "@/lib/db/schema";

// The live screen's poll: the event's check-in count. Super admins only, never cached.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await adminForRoute("super_admin");
  if (auth instanceof Response) return auth;
  const { slug } = await params;
  const [e] = await auth.db.select({ id: events.id }).from(events).where(and(eq(events.slug, slug), eq(events.status, "published")));
  if (!e) return Response.json({ error: "No such event" }, { status: 404 });
  const [{ n }] = await auth.db.select({ n: count() }).from(eventCheckins).where(eq(eventCheckins.eventId, e.id));
  return Response.json({ count: n }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
