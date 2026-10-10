"use server";

import { getDb } from "@/lib/db";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { ContactInput, notifyContactMessage, saveContactMessage, sendContactVerification, verifyContactMessage } from "@/lib/contact-messages";
import { reportError } from "@/lib/monitoring";
import { rateLimited, rateLimitedEmail } from "@/lib/security";
import { EXPIRED, formGuard } from "@/lib/form-guard";
import { HONEYPOT_FIELD } from "@/lib/honeypot";

export type ContactResult = { ok: true; privacy: boolean } | { ok: false; error: string } | null;

const GENERIC = "Something went wrong on our side. Please try again in a moment.";

/**
 * /contact (round 19). Same protection as the conference and accelerator forms: a honeypot, the
 * signed minimum-fill-time token (startJoin), and rate limits per IP and per email.
 */
export async function submitContact(_prev: ContactResult, fd: FormData): Promise<ContactResult> {
  const guard = formGuard("contact", String(fd.get("formToken") ?? ""), String(fd.get(HONEYPOT_FIELD) ?? ""));
  if (guard.kind === "expired") return { ok: false, error: EXPIRED };
  const parsed = ContactInput.safeParse(Object.fromEntries(fd));
  if (guard.kind === "drop") return { ok: true, privacy: parsed.success && parsed.data.topic !== "general" };
  // Suspected bots are saved flagged (no confirmation, no notification) and see the normal thank-you.
  const spam = guard.spam;
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const d = parsed.data;
  const db = getDb();
  if (!db) return { ok: false, error: process.env.VERCEL ? GENERIC : "DATABASE_URL isn't set, so nothing was saved. This message only appears outside Vercel." };
  try {
    if (await rateLimited(db, "contact", 5, 3600)) return { ok: false, error: "Too many messages from here. Please try again later." };
    if (await rateLimitedEmail(db, "contact", d.email, 3, 86400)) return { ok: false, error: "This message wasn't sent: you've already sent us 3 today. We'll reply to those; for anything new, please try again tomorrow." };
    const id = await saveContactMessage(db, d, spam);
    if (spam) return { ok: true, privacy: d.topic !== "general" };
    // Privacy requests: one confirmation email to the address given, after the response.
    if (d.topic !== "general") after(() => sendContactVerification(db, id, d.email).catch((e) => reportError("forms", "contact verification failed", e)));
    // And one notification to the super admin, Reply going to the sender.
    after(() => notifyContactMessage(db, id, d).catch((e) => reportError("forms", "contact notification failed", e)));
    return { ok: true, privacy: d.topic !== "general" };
  } catch (e) {
    reportError("forms", "contact message failed", e);
    return { ok: false, error: GENERIC };
  }
}

/** The confirmation page's button (a click, so link scanners can't use the link up). */
export async function confirmContact(fd: FormData) {
  const db = getDb();
  const ok = db ? await verifyContactMessage(db, String(fd.get("t") ?? "")).catch((e) => { reportError("forms", "contact verify failed", e); return false; }) : false;
  // The token leaves the URL either way.
  redirect(`/contact/verify?${ok ? "done=1" : "error=link"}`);
}
