"use server";

import { after } from "next/server";
import { joinFounder, notifyInterest, parseInterest, saveInterest } from "@/lib/accelerator-interest";
import { getDb } from "@/lib/db";
import type { InterestType } from "@/lib/db/schema";
import { rateLimited, rateLimitedEmail, verify } from "@/lib/security";

import { reportError } from "@/lib/monitoring";
export type InterestResult = { ok: true } | { ok: false; error: string } | null;

const MIN_FILL_MS = 3000;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const GENERIC = "Something went wrong on our side. Please try again in a moment.";

/**
 * The two forms on /accelerator. Same protection as the conference inquiry form: a honeypot, the
 * signed minimum-fill-time token (startJoin), and rate limits per IP and per email (shared by both
 * forms). Stored, then one email to SUPER_ADMIN_EMAIL after the response; nothing to the submitter.
 */
async function submit(type: InterestType, fd: FormData): Promise<InterestResult> {
  const issued = Number(verify(String(fd.get("formToken") ?? ""))?.split(".")[1]);
  const age = Date.now() - issued;
  if (!issued || age > MAX_FORM_AGE_MS) return { ok: false, error: "This form expired. Please reload the page and try again." };
  // Bots: the honeypot or an instant submit get the normal thank-you and nothing is stored.
  if (fd.get("website") || age < MIN_FILL_MS) return { ok: true };
  const parsed = parseInterest(type, fd);
  if (!parsed.ok) return parsed;
  const d = parsed.data;
  const db = getDb();
  if (!db) return { ok: false, error: process.env.VERCEL ? GENERIC : "DATABASE_URL isn't set, so nothing was saved. This message only appears outside Vercel." };
  try {
    if (await rateLimited(db, "accelerator", 5, 3600)) return { ok: false, error: "Too many messages from here. Please try again later." };
    if (await rateLimitedEmail(db, "accelerator", d.email, 3, 86400)) return { ok: false, error: "We already have your details. We'll be in touch." };
    const id = await saveInterest(db, d);
    // The same thank-you whether or not the email was already a member.
    if (d.type === "founder" && d.addMember) await joinFounder(db, d);
    after(() => notifyInterest(db, id, d).catch((e) => reportError("forms", "accelerator email failed", e)));
    return { ok: true };
  } catch (e) {
    reportError("forms", "accelerator interest failed", e);
    return { ok: false, error: GENERIC };
  }
}

export async function submitFounder(_prev: InterestResult, fd: FormData) {
  return submit("founder", fd);
}

export async function submitSupporter(_prev: InterestResult, fd: FormData) {
  return submit("supporter", fd);
}
