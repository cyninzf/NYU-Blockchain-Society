import * as Sentry from "@sentry/nextjs";
import type { Area } from "./sentry-options";

export type { Area } from "./sentry-options";

/**
 * A handled error: logged as before and sent to Sentry (when a DSN is set) tagged with its area,
 * e.g. "checkin" on event night. Never pass personal data in `label`; the event is scrubbed anyway.
 */
export function reportError(area: Area, label: string, e: unknown) {
  console.error(label, e instanceof Error ? e.message : e);
  Sentry.captureException(e instanceof Error ? e : new Error(`${label}: ${String(e)}`), { tags: { area }, extra: { label } });
}

export type FormName = "join" | "checkin" | "inquiry" | "accelerator" | "contact";

/**
 * A submission the bot guard flagged as suspected spam (round 20): it is saved, never dropped.
 * One log line and a Sentry breadcrumb with the form and the reason only, never the person's
 * details. Search the logs for "flagged:".
 */
export function recordFlag(form: FormName, reason: "too_fast") {
  console.warn(`${form} flagged: ${reason}`);
  Sentry.addBreadcrumb({ category: "form", level: "info", message: `${form} flagged: ${reason}` });
}
