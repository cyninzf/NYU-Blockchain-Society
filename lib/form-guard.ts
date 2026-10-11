import "server-only";
import type { SpamReason } from "./db/schema";
import { recordFlag, type FormName } from "./monitoring";
import { verify } from "./security";

// Bot protection shared by every public form: join, check-in quick join, the conference inquiry,
// both accelerator forms and contact. Nothing is ever silently discarded: a submission sent too
// fast to have been typed is saved flagged as suspected spam (no emails, no member) for a super
// admin to review, and sees the normal success. Each flag is logged with its reason only.
// There is no honeypot (round 21): Chrome and Safari AutoFill both filled hidden fields for real
// people however they were named, labelled or placed.

/**
 * Minimum time from the form's token (issued when the form appears) to submit. 2 seconds: no
 * person types a name, email and message faster, even with autofill, while scripts post at once.
 */
export const MIN_FILL_MS = 2000;
export const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
export const EXPIRED = "This form expired. Please reload the page and try again.";

/** "expired": the form token is missing, forged or older than a day (an error is shown). Otherwise saved, flagged when `spam` is set. */
export type GuardResult = { kind: "expired" } | { kind: "ok"; spam: SpamReason | null };

export function formGuard(form: FormName, formToken: string): GuardResult {
  const issued = Number(verify(formToken)?.split(".")[1]);
  const age = Date.now() - issued;
  if (!issued || age > MAX_FORM_AGE_MS) return { kind: "expired" };
  // Too fast to be typed: flagged, never dropped.
  if (age < MIN_FILL_MS) { recordFlag(form, "too_fast"); return { kind: "ok", spam: "too_fast" }; }
  return { kind: "ok", spam: null };
}
