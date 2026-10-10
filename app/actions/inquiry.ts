"use server";

import { after } from "next/server";
import { nextEdition } from "@/content/conferences";
import { getDb } from "@/lib/db";
import { InquiryInput, notifyInquiry, saveInquiry } from "@/lib/inquiries";
import { rateLimited, rateLimitedEmail } from "@/lib/security";
import { EXPIRED, formGuard } from "@/lib/form-guard";
import { HONEYPOT_FIELD } from "@/lib/honeypot";

import { reportError } from "@/lib/monitoring";
export type InquiryResult = { ok: true } | { ok: false; error: string } | null;

const GENERIC = "Something went wrong on our side. Please try again in a moment.";

/**
 * "Interested in sponsoring or speaking?" on /conference. Same protection as the join form:
 * a honeypot, the signed minimum-fill-time token (startJoin), and rate limits per IP and per
 * email. Stored, then one email to SUPER_ADMIN_EMAIL after the response; nothing to the inquirer.
 */
export async function submitInquiry(_prev: InquiryResult, fd: FormData): Promise<InquiryResult> {
  const guard = formGuard("inquiry", String(fd.get("formToken") ?? ""), String(fd.get(HONEYPOT_FIELD) ?? ""));
  if (guard === "expired") return { ok: false, error: EXPIRED };
  // Bots: the honeypot or an instant submit get the normal thank-you and nothing is stored (the drop is logged).
  if (guard === "drop") return { ok: true };
  const parsed = InquiryInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const db = getDb();
  if (!db) return { ok: false, error: process.env.VERCEL ? GENERIC : "DATABASE_URL isn't set, so nothing was saved. This message only appears outside Vercel." };
  try {
    if (await rateLimited(db, "inquiry", 5, 3600)) return { ok: false, error: "Too many messages from here. Please try again later." };
    if (await rateLimitedEmail(db, "inquiry", parsed.data.email, 3, 86400)) return { ok: false, error: "This message wasn't sent: you've already sent us 3 today. We'll reply to those; for anything new, please try again tomorrow." };
    const edition = String(nextEdition?.year ?? "next");
    const id = await saveInquiry(db, parsed.data, edition);
    after(() => notifyInquiry(db, id, parsed.data, edition).catch((e) => reportError("forms", "inquiry email failed", e)));
    return { ok: true };
  } catch (e) {
    reportError("forms", "inquiry failed", e);
    return { ok: false, error: GENERIC };
  }
}
