"use server";

import { getDb } from "@/lib/db";
import { ContactInput, saveContactMessage } from "@/lib/contact-messages";
import { reportError } from "@/lib/monitoring";
import { rateLimited, rateLimitedEmail, verify } from "@/lib/security";

export type ContactResult = { ok: true; privacy: boolean } | { ok: false; error: string } | null;

const MIN_FILL_MS = 3000;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const GENERIC = "Something went wrong on our side. Please try again in a moment.";

/**
 * /contact (round 19). Same protection as the conference and accelerator forms: a honeypot, the
 * signed minimum-fill-time token (startJoin), and rate limits per IP and per email.
 */
export async function submitContact(_prev: ContactResult, fd: FormData): Promise<ContactResult> {
  const issued = Number(verify(String(fd.get("formToken") ?? ""))?.split(".")[1]);
  const age = Date.now() - issued;
  if (!issued || age > MAX_FORM_AGE_MS) return { ok: false, error: "This form expired. Please reload the page and try again." };
  const parsed = ContactInput.safeParse(Object.fromEntries(fd));
  // Bots: the honeypot or an instant submit get the normal thank-you and nothing is stored.
  if (fd.get("website") || age < MIN_FILL_MS) return { ok: true, privacy: parsed.success && parsed.data.topic !== "general" };
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const d = parsed.data;
  const db = getDb();
  if (!db) return { ok: false, error: process.env.VERCEL ? GENERIC : "DATABASE_URL isn't set, so nothing was saved. This message only appears outside Vercel." };
  try {
    if (await rateLimited(db, "contact", 5, 3600)) return { ok: false, error: "Too many messages from here. Please try again later." };
    if (await rateLimitedEmail(db, "contact", d.email, 3, 86400)) return { ok: false, error: "We already have your messages. We'll be in touch." };
    await saveContactMessage(db, d);
    return { ok: true, privacy: d.topic !== "general" };
  } catch (e) {
    reportError("forms", "contact message failed", e);
    return { ok: false, error: GENERIC };
  }
}
