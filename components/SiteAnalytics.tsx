"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

// Vercel Web Analytics (round 16): cookieless page views on public pages only. Private pages and
// token links are never sent: the admin, "Update your block" and unsubscribe pages, emailed
// check-in links (/checkin/confirm?t=…), live screens and display links (/live?d=…), the
// event preview and privacy-request confirmations (/contact/verify?t=…).
// Query strings are dropped except a valid ?src= (how people arrived).
const PRIVATE = [/^\/admin(\/|$)/, /^\/update(\/|$)/, /^\/unsubscribe(\/|$)/, /^\/networking\/preview/, /^\/networking\/[^/]+\/checkin\/confirm/, /^\/networking\/[^/]+\/live/, /^\/contact\/verify/];

export function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  const u = new URL(event.url);
  if (PRIVATE.some((r) => r.test(u.pathname))) return null;
  const src = u.searchParams.get("src");
  u.search = src && /^[\w-]{1,40}$/.test(src) ? `?src=${src}` : "";
  u.hash = "";
  return { ...event, url: u.toString() };
}

export default function SiteAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
