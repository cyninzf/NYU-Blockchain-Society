"use server";

import { after } from "next/server";
import { joinFounder, notifyInterest, parseInterest, saveInterest } from "@/lib/accelerator-interest";
import { getDb } from "@/lib/db";
import type { InterestType } from "@/lib/db/schema";
import { rateLimited, rateLimitedEmail } from "@/lib/security";
import { EXPIRED, formGuard } from "@/lib/form-guard";
import { HONEYPOT_FIELD } from "@/lib/honeypot";

import { reportError } from "@/lib/monitoring";
export type InterestResult = { ok: true } | { ok: false; error: string } | null;

const GENERIC = "Something went wrong on our side. Please try again in a moment.";

/**
 * The two forms on /accelerator. Same protection as the conference inquiry form: a honeypot, the
 * signed minimum-fill-time token (startJoin), and rate limits per IP and per email (shared by both
 * forms). Stored, then one email to SUPER_ADMIN_EMAIL after the response; nothing to the submitter.
 */
async function submit(type: InterestType, fd: FormData): Promise<InterestResult> {
  const guard = formGuard("accelerator", String(fd.get("formToken") ?? ""), String(fd.get(HONEYPOT_FIELD) ?? ""));
  if (guard.kind === "expired") return { ok: false, error: EXPIRED };
  if (guard.kind === "drop") return { ok: true };
  // Suspected bots are saved flagged (no notification, no member) and see the normal thank-you.
  const spam = guard.spam;
  const parsed = parseInterest(type, fd);
  if (!parsed.ok) return parsed;
  const d = parsed.data;
  const db = getDb();
  if (!db) return { ok: false, error: process.env.VERCEL ? GENERIC : "DATABASE_URL isn't set, so nothing was saved. This message only appears outside Vercel." };
  try {
    if (await rateLimited(db, "accelerator", 5, 3600)) return { ok: false, error: "Too many messages from here. Please try again later." };
    if (await rateLimitedEmail(db, "accelerator", d.email, 3, 86400)) return { ok: false, error: "This wasn't sent: you've already sent us 3 today. We'll reply to those; for anything new, please try again tomorrow." };
    const id = await saveInterest(db, d, spam);
    if (spam) return { ok: true };
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
