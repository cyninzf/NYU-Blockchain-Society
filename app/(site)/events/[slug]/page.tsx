import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventDetail from "@/components/events/EventDetail";
import { metaDescription, siteName } from "@/content/site";
import { eventWhen } from "@/lib/event-time";
import { eventJsonLd, publicEvent, publicSlugs } from "@/lib/events";

// A published or cancelled event. Drafts and unknown slugs are a 404 (checked in proxy.ts too,
// for a real 404 status). Pages exist for every event that was public at build time; newer
// ones render on first request.

export async function generateStaticParams() {
  const slugs = await publicSlugs();
  // At least one entry keeps the route prerenderable when there are no events yet.
  return (slugs.length ? slugs : ["none"]).map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await publicEvent((await params).slug);
  if (!e) return { title: "Event not found", robots: { index: false } };
  const title = e.status === "cancelled" ? `${e.title} (cancelled)` : e.title;
  const description = metaDescription([eventWhen(e.startsAt, e.endsAt), e.venueName, e.cohost && `Co-hosted with ${e.cohost}`].filter(Boolean).join(" · ") + (e.description ? `. ${e.description}` : ""));
  const url = `/events/${e.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, siteName, title, description, locale: "en_US" },
    twitter: { card: "summary_large_image", site: "@NYU_Blockchain", title, description },
  };
}

export default async function EventPage({ params }: Props) {
  const e = await publicEvent((await params).slug);
  if (!e) notFound();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd(e)).replace(/</g, "\\u003c") }} />
      <EventDetail event={e} over={e.over} />
    </>
  );
}
