import Story from "@/components/story/Story";
import Chain from "@/components/Chain";
import JoinSection from "@/components/JoinSection";
import NetworkWall from "@/components/NetworkWall";
import { links, siteDescription, siteName, siteUrl } from "@/content/site";

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

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization).replace(/</g, "\\u003c") }} />
      <Story />
      <Chain />
      <NetworkWall />
      <JoinSection />
    </>
  );
}
