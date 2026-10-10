import { eventWhen } from "@/lib/event-time";
import { publicEvent, publicSlugs } from "@/lib/events";
import { ogImage, ogSize } from "@/lib/og";

// One share image per public event: label, title, date and time, venue, and the co-host as text
// only (never a logo), in the site's style.
export const alt = "NYU Blockchain Society event";
export const size = ogSize;
export const contentType = "image/png";

export async function generateStaticParams() {
  const slugs = await publicSlugs();
  return (slugs.length ? slugs : ["none"]).map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const e = await publicEvent((await params).slug);
  if (!e) return ogImage({ title: "Events", subtitle: "Networking for NYU alumni in blockchain, finance and AI." });
  return ogImage({
    kicker: [e.kind || "Event", e.status === "cancelled" ? "Cancelled" : null].filter(Boolean).join(" · "),
    title: e.title,
    subtitle: [eventWhen(e.startsAt, e.endsAt), e.venueName].filter(Boolean).join(" · "),
    footnote: e.cohost ? `Co-hosted with ${e.cohost}` : undefined,
  });
}
