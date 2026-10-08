import type { MetadataRoute } from "next";
import { pastEditions } from "@/content/conferences";
import { siteUrl } from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/conference`, changeFrequency: "monthly", priority: .8 },
    ...pastEditions.map((e) => ({ url: `${siteUrl}/conference/${e.year}`, changeFrequency: "yearly" as const, priority: .7 })),
  ];
}
