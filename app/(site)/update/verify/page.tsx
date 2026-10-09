import type { Metadata } from "next";
import { Suspense } from "react";
import { openWithLink } from "../actions";
import s from "../../account.module.css";

export const metadata: Metadata = {
  title: "Update your block",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type SP = Promise<Record<string, string | string[] | undefined>>;

/** The emailed link lands here. Continuing takes a click, so link scanners can't use it up. */
export default function VerifyPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className={`${s.page} page-top`}>
      <div className="wrap" data-bg="dim">
        <p className="kicker mono">Your block</p>
        <h1>Update your block</h1>
        <Suspense fallback={null}><Continue searchParams={searchParams} /></Suspense>
      </div>
    </div>
  );
}

async function Continue({ searchParams }: { searchParams: SP }) {
  const { t } = await searchParams;
  if (typeof t !== "string" || !t) return <p className={s.err}>This link is incomplete. <a href="/update">Ask for a new one</a>.</p>;
  return (
    <form action={openWithLink} className={s.form}>
      <input type="hidden" name="t" value={t} />
      <p className={s.lede}>Continue to edit your block. You&apos;ll stay signed in on this browser for 24 hours.</p>
      <div className={s.actions}><button className="btn btn-w" type="submit">Continue</button></div>
    </form>
  );
}
