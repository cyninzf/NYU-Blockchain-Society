import type { Metadata } from "next";
import Link from "next/link";
import { privacyContactLead, privacyDescription, privacySections, privacyUpdated } from "@/content/privacy";
import { siteName } from "@/content/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: privacyDescription,
  alternates: { canonical: "/privacy" },
  openGraph: { type: "website", url: "/privacy", siteName, title: `Privacy policy · ${siteName}`, description: privacyDescription, locale: "en_US" },
};

// "/update" in the copy becomes a link.
const withLinks = (t: string) => t.split(/(\/update)\b/).map((part, i) => (part === "/update" ? <Link key={i} href="/update">/update</Link> : part));

// The society's reply-to address (Vercel env, read at build time), for people who never got an email from us.
const contactEmail = () => {
  const e = process.env.REPLY_TO_EMAIL?.trim();
  return e && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e) ? e : null;
};

// Plain-English privacy policy (round 16). Copy in content/privacy.ts.
export default function PrivacyPage() {
  const contact = contactEmail();
  return (
    <section className="series privacy page-top" aria-labelledby="privacy-h">
      <div className="wrap">
        <div className="privacy-body" data-bg="solid">
        <p className="kicker mono">Last updated {privacyUpdated}</p>
        <h1 id="privacy-h">Privacy policy</h1>
        <p className="series-sub">The short version: we collect what you give us to run the society, only organizers see it, we never sell it, and you can leave or ask us to delete it at any time.</p>
        <nav className="privacy-toc" aria-label="On this page">
          <ol>{privacySections.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}</ol>
        </nav>
        {privacySections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
            <h2 id={`${s.id}-h`}>{s.title}</h2>
            {s.paragraphs?.map((p) => <p key={p}>{p}</p>)}
            {s.items && <ul>{s.items.map((i) => <li key={i}>{withLinks(i)}</li>)}</ul>}
            {s.after?.map((p) => <p key={p}>{p}</p>)}
            {s.id === "choices" && contact && <p className="privacy-contact">{privacyContactLead} <a href={`mailto:${contact}`}>{contact}</a>.</p>}
          </section>
        ))}
        </div>
      </div>
    </section>
  );
}
