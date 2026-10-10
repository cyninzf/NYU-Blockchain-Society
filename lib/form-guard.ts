import "server-only";
import { recordDrop, type FormName } from "./monitoring";
import { verify } from "./security";

// Bot protection shared by every public form (round 20): join, check-in, the conference inquiry,
// both accelerator forms and contact. A bot gets the normal success and nothing is stored; every
// such drop is recorded with its reason only (recordDrop), so real people being dropped shows up.

/**
 * Minimum time from the form's token (issued when the form appears) to submit. 2 seconds: no
 * person types a name, email and message faster, even with autofill, while scripts post at once.
 */
export const MIN_FILL_MS = 2000;
export const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
export const EXPIRED = "This form expired. Please reload the page and try again.";

export type GuardResult = "ok" | "expired" | "drop";

export function formGuard(form: FormName, formToken: string, honeypot: string): GuardResult {
  const issued = Number(verify(formToken)?.split(".")[1]);
  const age = Date.now() - issued;
  if (!issued || age > MAX_FORM_AGE_MS) return "expired";
  if (honeypot) { recordDrop(form, "honeypot"); return "drop"; }
  if (age < MIN_FILL_MS) { recordDrop(form, "too_fast"); return "drop"; }
  return "ok";
}
