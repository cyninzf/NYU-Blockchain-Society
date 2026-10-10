import type { Metadata } from "next";
import { Suspense } from "react";
import { confirmCheckin } from "@/app/actions/checkin";

export const metadata: Metadata = { title: "Check in", robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// The emailed link opens this page; checking in takes a button press, because mail scanners
// open links and would use them up.
export default function ConfirmPage(props: Props) {
  return <Suspense fallback={null}><Confirm {...props} /></Suspense>;
}

async function Confirm({ params, searchParams }: Props) {
  const { slug } = await params;
  const { t } = await searchParams;
  return (
    <section className="ci" aria-labelledby="ci-h">
      <div className="ci-card" data-bg="solid">
        <p className="kicker mono">Check-in</p>
        <h1 id="ci-h">One tap to check in</h1>
        <form action={confirmCheckin} className="ci-step">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="t" value={typeof t === "string" ? t : ""} />
          <button className="btn btn-w" type="submit">Check in</button>
        </form>
      </div>
    </section>
  );
}
