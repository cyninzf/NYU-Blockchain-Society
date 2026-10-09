import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Admin contacts import sends a CSV (max 4 MB) to a server action.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default nextConfig;
