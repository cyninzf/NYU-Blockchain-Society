"use server";

import { after } from "next/server";
import { nextEdition } from "@/content/conferences";
import { getDb } from "@/lib/db";
import { InquiryInput, notifyInquiry, saveInquiry } from "@/lib/inquiries";
import { rateLimited, rateLimitedEmail, verify } from "@/lib/security";

export type InquiryResult = { ok: true } | { ok: false; error: string } | null;

const MIN_FILL_MS = 3000;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const GENERIC = "Something went wrong on our side. Please try again in a moment.";

/**
 * "Interested in sponsoring or speaking?" on /conference. Same protection as the join form:
 * a honeypot, the signed minimum-fill-time token (startJoin), and rate limits per IP and per
 * email. Stored, then one email to SUPER_ADMIN_EMAIL after the response; nothing to the inquirer.
 */
export async function submitInquiry(_prev: InquiryResult, fd: FormData): Promise<InquiryResult> {
  const issued = Number(verify(String(fd.get("formToken") ?? ""))?.split(".")[1]);
  const age = Date.now() - issued;
  if (!issued || age > MAX_FORM_AGE_MS) return { ok: false, error: "This form expired. Please reload the page and try again." };
  // Bots: the honeypot or an instant submit get the normal thank-you and nothing is stored.
  if (fd.get("website") || age < MIN_FILL_MS) return { ok: true };
  const parsed = InquiryInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const db = getDb();
  if (!db) return { ok: false, error: process.env.VERCEL ? GENERIC : "DATABASE_URL isn't set, so nothing was saved. This message only appears outside Vercel." };
  try {
    if (await rateLimited(db, "inquiry", 5, 3600)) return { ok: false, error: "Too many messages from here. Please try again later." };
    if (await rateLimitedEmail(db, "inquiry", parsed.data.email, 3, 86400)) return { ok: false, error: "We already have your messages. We'll be in touch." };
    const edition = String(nextEdition?.year ?? "next");
    const id = await saveInquiry(db, parsed.data, edition);
    after(() => notifyInquiry(db, id, parsed.data, edition).catch((e) => console.error("inquiry email failed", e instanceof Error ? e.message : e)));
    return { ok: true };
  } catch (e) {
    console.error("inquiry failed", e instanceof Error ? e.message : e);
    return { ok: false, error: GENERIC };
  }
}
