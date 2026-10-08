import { editionByYear, editionTitle, pastEditions, statsLine } from "@/content/conferences";
import { ogImage, ogSize } from "@/lib/og";

export const alt = "NYU Blockchain Conference edition";
export const size = ogSize;
export const contentType = "image/png";

export function generateStaticParams() {
  return pastEditions.map((e) => ({ year: String(e.year) }));
}

export default async function Image({ params }: { params: Promise<{ year: string }> }) {
  const e = editionByYear(Number((await params).year))!;
  return ogImage({
    title: editionTitle(e),
    subtitle: [[e.date, e.venue].filter(Boolean).join(" · "), e.stats && statsLine(e.stats)].filter(Boolean).join(". "),
  });
}
