import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EditionDetail from "@/components/conference/EditionDetail";
import { editionByYear, editionTitle, pastEditions, statsLine } from "@/content/conferences";
import { siteName } from "@/content/site";

export function generateStaticParams() {
  return pastEditions.map((e) => ({ year: String(e.year) }));
}

type Props = { params: Promise<{ year: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = editionByYear(Number((await params).year));
  if (!e?.year) return {};
  const title = editionTitle(e);
  const description = [[e.date, e.address].filter(Boolean).join(" · "), e.stats && statsLine(e.stats)].filter(Boolean).join(". ") + ".";
  const url = `/conference/${e.year}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, siteName, title, description, locale: "en_US" },
    twitter: { card: "summary_large_image", site: "@NYU_Blockchain", title, description },
  };
}

export default async function EditionPage({ params }: Props) {
  const e = editionByYear(Number((await params).year));
  if (!e?.year) notFound();
  return (
    <section className="conf page-top" aria-labelledby="conf-h">
      <div className="wrap crumbs mono"><Link href="/conference">← All editions</Link></div>
      <EditionDetail edition={e} />
    </section>
  );
}
