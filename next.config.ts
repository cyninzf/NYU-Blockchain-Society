import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Admin contacts import sends a CSV (max 4 MB) to a server action.
  // authInterrupts: forbidden() answers super-admin-only actions with a real 403 (lib/admin.ts).
  experimental: { serverActions: { bodySizeLimit: "5mb" }, authInterrupts: true },
};

export default nextConfig;
