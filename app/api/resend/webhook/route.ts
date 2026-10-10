import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { suppress } from "@/lib/invites";

// Resend's delivery webhook (round 12): hard bounces (email.bounced) and spam complaints
// (email.complained) put the address on the suppression list, so it never gets an invite, or
// any other email, again. Signed the Svix way with RESEND_WEBHOOK_SECRET ("whsec_…"); anything
// unsigned, badly signed or older than 5 minutes is refused.

const TOLERANCE_S = 5 * 60;

function verified(body: string, h: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const id = h.get("svix-id"), ts = h.get("svix-timestamp"), sigs = h.get("svix-signature");
  if (!secret?.startsWith("whsec_") || !id || !ts || !sigs) return false;
  if (!/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > TOLERANCE_S) return false;
  const expected = createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`${id}.${ts}.${body}`).digest();
  return sigs.split(" ").some((s) => {
    const [v, sig] = s.split(",");
    if (v !== "v1" || !sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  if (!verified(body, request.headers)) return new Response("Invalid signature.", { status: 401 });
  const event = JSON.parse(body) as { type?: string; data?: { to?: string[] | string } };
  const reason = event.type === "email.bounced" ? "bounce" : event.type === "email.complained" ? "complaint" : null;
  const db = getDb();
  if (reason && db) {
    const to = Array.isArray(event.data?.to) ? event.data.to : event.data?.to ? [event.data.to] : [];
    for (const email of to.slice(0, 50)) await suppress(db, email, reason);
  }
  // Other events (delivered, opened…) are acknowledged and ignored: nothing about them is stored.
  return new Response("OK", { status: 200 });
}
