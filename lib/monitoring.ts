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
 * A submission treated as a bot and dropped (round 20): one log line and a Sentry breadcrumb
 * with the form and the reason only, never the person's details. Search the logs for "dropped:".
 */
export function recordDrop(form: FormName, reason: "honeypot" | "too_fast") {
  console.warn(`${form} dropped: ${reason}`);
  Sentry.addBreadcrumb({ category: "form", level: "info", message: `${form} dropped: ${reason}` });
}
