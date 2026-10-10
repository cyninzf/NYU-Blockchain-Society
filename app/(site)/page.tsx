import Story from "@/components/story/Story";
import Chain from "@/components/Chain";
import JoinSection from "@/components/JoinSection";
import ChainStats from "@/components/ChainStats";
import { links, siteDescription, siteName, siteUrl } from "@/content/site";
import { eventJsonLd, publicEvents } from "@/lib/events";

// Structured data for search engines. NYU is not claimed as parentOrganization.
const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName,
  url: `${siteUrl}/`,
  logo: `${siteUrl}/media-kit/avatar-512.png`,
  description: siteDescription,
  sameAs: [links.x, links.linkedin, links.nyuAlumni],
};

export default async function Home() {
  // Upcoming published events ride along as the Organization's `event`.
  const { upcoming } = await publicEvents();
  const events = upcoming.filter((e) => e.status === "published").map((e) => eventJsonLd(e, true));
  const data = events.length ? { ...organization, event: events } : organization;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
      <Story />
      <Chain />
      <ChainStats />
      <JoinSection />
    </>
  );
}
