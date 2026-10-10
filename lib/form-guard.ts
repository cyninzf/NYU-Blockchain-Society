import "server-only";
import type { SpamReason } from "./db/schema";
import { recordDrop, type FormName } from "./monitoring";
import { verify } from "./security";

// Bot protection shared by every public form (round 20): join, check-in, the conference inquiry,
// both accelerator forms and contact. Nothing is ever silently discarded: a suspected bot is saved
// flagged as suspected spam (no emails, no member) for a super admin to review, and sees the normal
// success. Each flag is recorded with its reason only (recordDrop).

/**
 * Minimum time from the form's token (issued when the form appears) to submit. 2 seconds: no
 * person types a name, email and message faster, even with autofill, while scripts post at once.
 */
export const MIN_FILL_MS = 2000;
export const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
export const EXPIRED = "This form expired. Please reload the page and try again.";

/** "expired": the form token is missing, forged or older than a day (an error is shown). */
export type GuardResult = { kind: "expired" } | { kind: "drop" } | { kind: "ok"; spam: SpamReason | null };

export function formGuard(form: FormName, formToken: string, honeypot: string): GuardResult {
  const issued = Number(verify(formToken)?.split(".")[1]);
  const age = Date.now() - issued;
  if (!issued || age > MAX_FORM_AGE_MS) return { kind: "expired" };
  // Autofill can fill the honeypot for a real person, so it only flags: saved, reviewed by a person.
  if (honeypot) { recordDrop(form, "honeypot"); return { kind: "ok", spam: "honeypot" }; }
  if (age < MIN_FILL_MS) { recordDrop(form, "too_fast"); return { kind: "drop" }; }
  return { kind: "ok", spam: null };
}
