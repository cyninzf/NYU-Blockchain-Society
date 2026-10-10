import type { MetadataRoute } from "next";
import { pastEditions } from "@/content/conferences";
import { siteUrl } from "@/content/site";
import { publicEvents } from "@/lib/events";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { upcoming, past } = await publicEvents();
  return [
    { url: `${siteUrl}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/conference`, changeFrequency: "monthly", priority: .8 },
    { url: `${siteUrl}/events`, changeFrequency: "weekly", priority: .8 },
    { url: `${siteUrl}/accelerator`, changeFrequency: "monthly", priority: .7 },
    { url: `${siteUrl}/media-kit`, changeFrequency: "yearly", priority: .5 },
    ...pastEditions.map((e) => ({ url: `${siteUrl}/conference/${e.year}`, changeFrequency: "yearly" as const, priority: .7 })),
    // Published events (cancelled ones only until their date, while their page still exists).
    ...[...upcoming, ...past].map((e) => ({ url: `${siteUrl}/events/${e.slug}`, lastModified: e.updatedAt, changeFrequency: "weekly" as const, priority: e.over ? .4 : .7 })),
  ];
}
