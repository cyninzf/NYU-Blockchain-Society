import { and, asc, eq } from "drizzle-orm";
import { adminForRoute, audit } from "@/lib/admin";
import { csvResponse } from "@/lib/csv";
import { eventCheckins, events, members } from "@/lib/db/schema";

// The check-in list as CSV (real check-ins only, never test ones): super admins only, and logged like every export.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await adminForRoute("super_admin");
  if (auth instanceof Response) return auth;
  const { db, actor } = auth;
  const id = Number((await params).id);
  const [e] = Number.isInteger(id) && id > 0 ? await db.select({ slug: events.slug }).from(events).where(eq(events.id, id)) : [];
  if (!e) return new Response("No such event.", { status: 404 });
  const rows = await db.select({ block: members.id, name: members.name, email: members.email, checkedInAt: eventCheckins.checkedInAt, method: eventCheckins.method })
    .from(eventCheckins).innerJoin(members, eq(members.id, eventCheckins.memberId)).where(and(eq(eventCheckins.eventId, id), eq(eventCheckins.isTest, false))).orderBy(asc(eventCheckins.checkedInAt));
  await audit(db, actor, "export.checkins", `Exported ${rows.length} check-ins for event #${id}`);
  return csvResponse(`checkins-${e.slug}`, ["block", "name", "email", "checkedInAt", "method"], rows);
}
