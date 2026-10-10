import { timingSafeEqual } from "node:crypto";
import { auditRow } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { adminAudit } from "@/lib/db/schema";
import { processInvites } from "@/lib/invite-queue";

// The daily invite run (vercel.json cron). Vercel calls it with "Authorization: Bearer
// <CRON_SECRET>"; without that secret set, or with any other header, it refuses.
export const maxDuration = 60;

function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header), b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) return new Response("Unauthorized.", { status: 401 });
  const db = getDb();
  if (!db) return Response.json({ error: "No database" }, { status: 503 });
  const r = await processInvites(db);
  if (r.sent || r.failed || r.skipped) {
    await db.insert(adminAudit).values(auditRow("system", "invite.run", `Daily invite run: ${r.sent} sent, ${r.failed} failed, ${r.skipped} skipped${r.note ? ` (${r.note})` : ""}`));
  }
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
