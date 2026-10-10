import { and, count, eq } from "drizzle-orm";
import { adminForRoute } from "@/lib/admin";
import { getDb, type Db } from "@/lib/db";
import { eventCheckins, events } from "@/lib/db/schema";
import { displayAccess } from "@/lib/display-links";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });

/** Real check-ins only, unless `test` (then test check-ins only). */
const countFor = async (db: Db, eventId: number, test = false) =>
  (await db.select({ n: count() }).from(eventCheckins).where(and(eq(eventCheckins.eventId, eventId), eq(eventCheckins.isTest, test))))[0].n;

// The live screen's poll: the event's check-in count, never cached. Either a display link
// (?d=, that event only, while check-in is open; no cookie involved) or a super admin session.
// ?test=1 (super admin session only): the test check-ins instead, on any event, drafts too.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sp = new URL(request.url).searchParams;
  const d = sp.get("d"), test = sp.get("test") === "1";
  if (d && !test) {
    const db = getDb();
    if (!db) return json({ error: "No database" }, 503);
    const a = await displayAccess(db, slug, d);
    return a.ok ? json({ count: await countFor(db, a.eventId) }) : json({ error: a.reason === "closed" ? "Closed" : "Invalid link" }, 403);
  }
  const auth = await adminForRoute("super_admin");
  if (auth instanceof Response) return auth;
  const [e] = await auth.db.select({ id: events.id }).from(events).where(test ? eq(events.slug, slug) : and(eq(events.slug, slug), eq(events.status, "published")));
  if (!e) return json({ error: "No such event" }, 404);
  return json({ count: await countFor(auth.db, e.id, test) });
}
