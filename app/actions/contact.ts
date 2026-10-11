"use server";

import { getDb } from "@/lib/db";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { ContactInput, receiveContact, verifyContactMessage } from "@/lib/contact-messages";
import { reportError } from "@/lib/monitoring";
import { rateLimited, rateLimitedEmail } from "@/lib/security";
import { EXPIRED, formGuard } from "@/lib/form-guard";

export type ContactResult = { ok: true; privacy: boolean } | { ok: false; error: string } | null;

const GENERIC = "Something went wrong on our side. Please try again in a moment.";

/**
 * /contact (round 19). Same protection as the conference and accelerator forms: the
 * signed minimum-fill-time token (startJoin), and rate limits per IP and per email.
 */
export async function submitContact(_prev: ContactResult, fd: FormData): Promise<ContactResult> {
  const guard = formGuard("contact", String(fd.get("formToken") ?? ""));
  if (guard.kind === "expired") return { ok: false, error: EXPIRED };
  const parsed = ContactInput.safeParse(Object.fromEntries(fd));
  // Suspected bots are saved flagged (no confirmation, no notification) and see the normal thank-you.
  const spam = guard.spam;
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const d = parsed.data;
  const db = getDb();
  if (!db) return { ok: false, error: process.env.VERCEL ? GENERIC : "DATABASE_URL isn't set, so nothing was saved. This message only appears outside Vercel." };
  try {
    if (await rateLimited(db, "contact", 5, 3600)) return { ok: false, error: "Too many messages from here. Please try again later." };
    if (await rateLimitedEmail(db, "contact", d.email, 3, 86400)) return { ok: false, error: "This message wasn't sent: you've already sent us 3 today. We'll reply to those; for anything new, please try again tomorrow." };
    // Flagged messages are saved and send nothing; the sender sees the same thank-you.
    await receiveContact(db, d, spam, (work) => after(() => work().catch((e) => reportError("forms", "contact email failed", e))));
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
