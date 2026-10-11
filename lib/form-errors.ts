import type { ZodError } from "zod";

// Field-level validation for every public form (round 21), shared by the browser check and the
// server. The server's zod checks stay the real guard; the browser check catches obvious mistakes
// first. Both show each error next to its field, and the form is never cleared.

export type FieldErrors = Record<string, string>;

/** The messages both sides use, so the browser and the server say the same thing. */
export const MSG = {
  name: "Add your name.",
  email: "Enter an email we can reply to, like name@example.com.",
  message: (min: number) => `Tell us a little more (at least ${min} characters).`,
  tooLong: (max: number) => `Keep it under ${max.toLocaleString("en-US")} characters.`,
  required: "Fill this in.",
  pick: "Pick one.",
  pickAny: "Pick at least one.",
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The first zod issue per field, keyed by form field name (`rename` maps schema keys to field names). */
export function zodFieldErrors(error: ZodError, rename: Record<string, string> = {}): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    const name = rename[key] ?? key;
    if (name && !out[name]) out[name] = issue.message;
  }
  return out;
}

/** What the person typed, echoed back with errors (never the form token). */
export function submittedValues(fd: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(fd.keys())) {
    if (key === "formToken" || key.startsWith("$")) continue;
    const all = fd.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = all.length > 1 ? all : (all[0] ?? "");
  }
  return out;
}
