import type { Metadata } from "next";
import { Suspense } from "react";
import RequestLink from "./RequestLink";
import s from "../account.module.css";

export const metadata: Metadata = {
  title: "Update your block",
  description: "Change your blocks, details and email preferences.",
  robots: { index: false, follow: true },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function UpdatePage({ searchParams }: { searchParams: SP }) {
  return (
    <div className={`${s.page} page-top`}>
      <div className="wrap" data-bg="dim">
        <p className="kicker mono">Your block</p>
        <h1>Update your block</h1>
        <p className={s.lede}>Enter the email you joined with and we&apos;ll send you a link to change your blocks, details and email preferences. No password needed.</p>
        <Suspense fallback={null}><LinkError searchParams={searchParams} /></Suspense>
        <RequestLink />
      </div>
    </div>
  );
}

async function LinkError({ searchParams }: { searchParams: SP }) {
  const { error } = await searchParams;
  return error === "link" ? <p className={s.err} role="alert" style={{ marginBottom: 16 }}>That link has expired or was already used. Ask for a new one below.</p> : null;
}
