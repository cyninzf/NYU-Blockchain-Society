import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

// Sentry settings shared by the server, edge and browser (round 16). Off unless a DSN is set.
// Privacy first: no default PII, no session replay, no tracing, and every event is scrubbed
// before it leaves: no user, cookies, headers, request bodies or query strings (magic-link,
// unsubscribe, invite and display-link tokens all live in query strings); email addresses and
// token-like parameters are masked in messages, exceptions and breadcrumbs.

/** Where an error happened, as a Sentry tag, so event-night problems are easy to filter. */
export type Area = "join" | "checkin" | "live" | "invite" | "announcements" | "admin" | "update" | "forms" | "site";

const EMAIL = /[^\s@<>"'(),;:/]+@[^\s@<>"'(),;:/]+\.[a-z]{2,}/gi;
const TOKEN_PARAM = /\b(t|d|token|invite|code|key|secret|sig)=([^&\s#"']+)/gi;
const BEARER = /\b(Bearer|whsec_|re_)[\w.-]{8,}/g;

export const scrubText = (s: string) => s.replace(EMAIL, "[email]").replace(TOKEN_PARAM, "$1=[redacted]").replace(BEARER, "[redacted]");
/** Path only: query strings and fragments can carry tokens. */
export const scrubUrl = (u: string) => scrubText(u.split(/[?#]/)[0]);

/** The area for a request path (errors reported with reportError carry their own). */
export function areaForPath(path: string): Area {
  if (/^\/networking\/[^/]+\/checkin/.test(path)) return "checkin";
  if (/^\/networking\/[^/]+\/live/.test(path) || /^\/api\/events\/[^/]+\/checkins/.test(path)) return "live";
  if (path.startsWith("/admin/contacts/invite") || path.startsWith("/api/cron/invites")) return "invite";
  if (path.startsWith("/admin/announcements")) return "announcements";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/update") || path.startsWith("/unsubscribe") || path.startsWith("/api/unsubscribe")) return "update";
  if (path.startsWith("/conference") || path.startsWith("/accelerator")) return "forms";
  return "site";
}

const scrubDeep = (v: unknown, depth = 0): unknown => {
  if (typeof v === "string") return scrubText(v);
  if (depth > 4 || !v || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x) => scrubDeep(x, depth + 1));
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /cookie|authorization|token|password|secret|email|^name$|^user/i.test(k) ? "[redacted]" : scrubDeep(x, depth + 1)]));
};

const pathOf = (url: string) => { try { return new URL(url, "https://x.invalid").pathname; } catch { return url.split(/[?#]/)[0]; } };

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    const url = event.request.url ?? "";
    if (!event.tags?.area && url) event.tags = { ...event.tags, area: areaForPath(pathOf(url)) };
    // Keep only the path and method: no cookies, headers, body, query string or env.
    event.request = { url: url ? scrubUrl(url) : undefined, method: event.request.method };
  }
  if (!event.tags?.area && typeof window !== "undefined") event.tags = { ...event.tags, area: areaForPath(location.pathname) };
  if (event.message) event.message = scrubText(event.message);
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  for (const ex of event.exception?.values ?? []) if (ex.value) ex.value = scrubText(ex.value);
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb).filter((b): b is Breadcrumb => b !== null);
  if (event.extra) event.extra = scrubDeep(event.extra) as typeof event.extra;
  if (event.contexts) event.contexts = scrubDeep(event.contexts) as typeof event.contexts;
  return event;
}

export function scrubBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  if (b.message) b.message = scrubText(b.message);
  if (b.data) {
    const d: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(b.data)) d[k] = typeof v === "string" && /url|from|to/i.test(k) ? scrubUrl(v) : scrubDeep(v);
    b.data = d;
  }
  return b;
}

/** Sentry.init options for one runtime; `dsn` undefined keeps Sentry off. */
export const sentryOptions = (dsn: string | undefined, environment: string | undefined) => ({
  dsn,
  enabled: Boolean(dsn),
  environment: environment ?? "development",
  sendDefaultPii: false,
  // Errors only: no performance tracing (spans carry URLs) and no session replay.
  tracesSampleRate: 0,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
});
