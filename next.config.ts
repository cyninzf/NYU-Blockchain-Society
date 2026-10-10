import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Admin contacts import sends a CSV (max 4 MB) to a server action.
  // authInterrupts: forbidden() answers super-admin-only actions with a real 403 (lib/admin.ts).
  experimental: { serverActions: { bodySizeLimit: "5mb" }, authInterrupts: true },
  // Block 01's canonical page is /networking (round 15). Every old /events path (event pages,
  // check-in and its emailed links, live screens and display links, calendar.ics, share images,
  // the preview) answers with a permanent 308 to the same path under /networking; the query
  // string (?src=event-<slug>, ?d=, ?t=, ?test=1) is kept.
  async redirects() {
    return [
      // Share images carry a suffix hashed from their route's path, so it changed with the move
      // (events: 1j24gg, networking: 9a9qmr). Old image URLs map to the new suffix.
      { source: "/events/:slug/:kind(opengraph-image|twitter-image)-:hash", destination: "/networking/:slug/:kind-9a9qmr", permanent: true },
      { source: "/events", destination: "/networking", permanent: true },
      { source: "/events/:path*", destination: "/networking/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
