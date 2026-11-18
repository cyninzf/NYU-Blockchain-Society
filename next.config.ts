import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Admin contacts import sends a CSV (max 4 MB) to a server action.
  // authInterrupts: forbidden() answers super-admin-only actions with a real 403 (lib/admin.ts).
  experimental: { serverActions: { bodySizeLimit: "5mb" }, authInterrupts: true },
  // Block 01's canonical page is /events (round 33; it was /networking from round 15). Every
  // /networking path (event pages, check-in and its emailed links and printed QR codes,
  // calendar.ics, share images, the preview) answers with a permanent 301 to the same path under
  // /events; the query string (?src=event-<slug>, ?t=, ?d=, ?test=1) is kept, and browsers keep
  // the #fragment (#agenda). Before round 15, /events was already the path, so those links work as is.
  async redirects() {
    return [
      // Share images carry a suffix hashed from their route's path (networking: 9a9qmr;
      // events: 1j24gg, before round 15 and again since round 33). Old image URLs map to it.
      { source: "/networking/:slug/:kind(opengraph-image|twitter-image)-:hash", destination: "/events/:slug/:kind-1j24gg", statusCode: 301 },
      { source: "/networking", destination: "/events", statusCode: 301 },
      { source: "/networking/:path*", destination: "/events/:path*", statusCode: 301 },
    ];
  },
};

// Error monitoring (round 16). Runtime errors need only SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN; source
// maps upload at build time only when SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT are set,
// and are deleted from the deployment after upload (they're never public).
const sourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !sourceMaps,
  telemetry: false,
  sourcemaps: { disable: !sourceMaps, deleteSourcemapsAfterUpload: true },
  widenClientFileUpload: true,
});
