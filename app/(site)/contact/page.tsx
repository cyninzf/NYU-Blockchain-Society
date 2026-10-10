import type { Metadata } from "next";
import ContactForm from "@/components/contact/ContactForm";
import { contactPage } from "@/content/contact";
import { siteName } from "@/content/site";

const { title, description } = contactPage;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contact" },
  openGraph: { type: "website", url: "/contact", siteName, title: `${title} · ${siteName}`, description, locale: "en_US" },
};

// The society's only public way in (round 19): no public email address anywhere.
export default function ContactPage() {
  return (
    <section className="series page-top" aria-labelledby="contact-h">
      <div className="wrap">
        <div className="iq">
          <div data-bg="dim">
            <h1 id="contact-h">{title}</h1>
            <p className="series-sub">{contactPage.intro}</p>
          </div>
          <div data-bg="dim"><ContactForm /></div>
        </div>
      </div>
    </section>
  );
}
