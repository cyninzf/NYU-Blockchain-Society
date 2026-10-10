import { editionStatus, editionTitle, nextEdition, pastEditions, series } from "@/content/conferences";
import { ogImage } from "@/lib/og";

// /conference's share image (round 13): the next edition without a date, and the first edition
// as proof. A route (not a file convention) so /conference/2024 keeps its own images unchanged.
export async function GET() {
  const first = pastEditions[0];
  const res = await ogImage({
    kicker: nextEdition ? editionStatus(nextEdition) : `Annual since ${series.since}`,
    title: nextEdition ? editionTitle(nextEdition) : series.name,
    subtitle: first?.stats
      ? `The first edition at NYU: ${first.stats.registrations} registrations, ${first.stats.speakers} speakers and moderators, ${first.stats.panels} panels plus a fireside.`
      : `Annual, since ${series.since}.`,
  });
  res.headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
  return res;
}
