import { siteUrl } from "@/content/site";

/**
 * Where links in emails point. Production uses the canonical domain; a preview deployment links
 * to itself, because its magic links and unsubscribe tokens live in that preview's database.
 */
export function baseUrl(): string {
  if (process.env.VERCEL_ENV === "production") return siteUrl;
  const host = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : "http://localhost:3000";
}

/** Real deployments only: previews share production's members, so bulk sends stay in production. */
export const isProduction = () => process.env.VERCEL_ENV === "production";
