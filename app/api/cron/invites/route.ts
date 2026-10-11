import { timingSafeEqual } from "node:crypto";
import { auditRow } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { adminAudit } from "@/lib/db/schema";
import { runDigest } from "@/lib/digest";
import { processInvites } from "@/lib/invite-queue";
import { reportError } from "@/lib/monitoring";

// The daily invite runs (vercel.json cron, 15:00 and 03:00 UTC). The 15:00 UTC run (morning in
// New York: 11:00 EDT, 10:00 EST) also sends the daily admin digest (lib/digest.ts). Vercel calls it with "Authorization: Bearer
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
  // Morning run only (Vercel fires within the scheduled hour). First, so a failed invite run can't hold it up; a failed digest never stops the invites.
  const digest = new Date().getUTCHours() >= 12
    ? await runDigest(db).catch((e) => { reportError("admin", "digest failed", e); return { sent: 0, skipped: 0, note: "failed" }; })
    : null;
  const r = await processInvites(db);
  if (r.sent || r.failed || r.skipped) {
    await db.insert(adminAudit).values(auditRow("system", "invite.run", `Daily invite run: ${r.sent} sent, ${r.failed} failed, ${r.skipped} skipped${r.note ? ` (${r.note})` : ""}`));
  }
  return Response.json({ ...r, digest }, { headers: { "Cache-Control": "no-store" } });
}
