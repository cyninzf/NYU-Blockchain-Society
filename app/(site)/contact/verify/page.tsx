import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { confirmContact } from "@/app/actions/contact";

export const metadata: Metadata = {
  title: "Confirm your request",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type SP = Promise<Record<string, string | string[] | undefined>>;

/** The emailed link for a privacy request lands here (round 19). Confirming takes a click. */
export default function ContactVerifyPage({ searchParams }: { searchParams: SP }) {
  return (
    <section className="series page-top" aria-labelledby="cv-h">
      <div className="wrap">
        <div className="iq" data-bg="dim">
          <h1 id="cv-h">Confirm your request</h1>
          <Suspense fallback={null}><Step searchParams={searchParams} /></Suspense>
        </div>
      </div>
    </section>
  );
}

async function Step({ searchParams }: { searchParams: SP }) {
  const { t, done, error } = await searchParams;
  if (done) return <p className="iq-done" role="status">Thank you: your request is confirmed. An organizer will take care of it and reply by email.</p>;
  if (error || typeof t !== "string" || !t) {
    return <p className="series-sub" role="alert">This link has expired or was already used. If you still need something, <Link href="/contact">send the form again</Link>.</p>;
  }
  return (
    <form action={confirmContact} className="iq-form">
      <input type="hidden" name="t" value={t} />
      <p className="series-sub">Confirm that this privacy request comes from you. We act on it only once it&apos;s confirmed.</p>
      <button className="btn btn-w" type="submit">Confirm my request</button>
    </form>
  );
}
