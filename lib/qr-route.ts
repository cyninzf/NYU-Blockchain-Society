import "server-only";
import { eq } from "drizzle-orm";
import { adminForRoute } from "./admin";
import { events } from "./db/schema";

/** For the QR download routes: the event's slug for a super admin, or the error Response. */
export async function qrEvent(params: Promise<{ id: string }>): Promise<{ slug: string } | Response> {
  const auth = await adminForRoute("super_admin");
  if (auth instanceof Response) return auth;
  const id = Number((await params).id);
  const [e] = Number.isInteger(id) && id > 0 ? await auth.db.select({ slug: events.slug }).from(events).where(eq(events.id, id)) : [];
  return e ?? new Response("No such event.", { status: 404 });
}

export const download = (body: BodyInit, type: string, name: string) => new Response(body, {
  headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
});
