import type { Metadata } from "next";
import { Suspense } from "react";
import { unsubscribeTarget } from "@/lib/unsubscribe";
import Unsubscribe from "./Unsubscribe";
import s from "../account.module.css";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type SP = Promise<Record<string, string | string[] | undefined>>;

/** From the link in every email. No login. One button (link scanners open pages, they don't press buttons). */
export default function UnsubscribePage({ searchParams }: { searchParams: SP }) {
  return (
    <div className={`${s.page} page-top`}>
      <div className="wrap" data-bg="dim">
        <p className="kicker mono">Email preferences</p>
        <h1>Unsubscribe</h1>
        <p className={s.lede}>Stop all emails from NYU Blockchain Society: event news, program updates and announcements.</p>
        <Suspense fallback={null}><Form searchParams={searchParams} /></Suspense>
      </div>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: SP }) {
  const { t } = await searchParams;
  if (typeof t !== "string" || !t) return <p className={s.err}>This link is incomplete. Use the unsubscribe link from your most recent email.</p>;
  return <Unsubscribe t={t} invite={unsubscribeTarget(t)?.kind === "contact"} />;
}
