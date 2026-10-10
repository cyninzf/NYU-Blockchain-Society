import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { memberIdFromSession } from "@/lib/member-session";

export type Me = { member: false } | { member: true; notify: string[] };

/**
 * Whether this browser has a live member session ("Update your block" or a check-in link), and
 * which programs that member hears about. Only the cookie's own member, never cached. Used by
 * "Get notified" to show "You're on the list" instead of the join flow (round 14).
 */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const id = await memberIdFromSession().catch(() => null);
  const db = getDb();
  if (!id || !db) return Response.json({ member: false } satisfies Me, { headers });
  const [m] = await db.select({ notify: members.notify }).from(members).where(eq(members.id, id));
  return Response.json((m ? { member: true, notify: m.notify } : { member: false }) satisfies Me, { headers });
}
