import type { Metadata } from "next";
import { Suspense } from "react";
import { signInWithLink } from "../actions";
import styles from "../../admin.module.css";

export const metadata: Metadata = {
  title: "Sign in · Admin",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type SP = Promise<Record<string, string | string[] | undefined>>;

/** The emailed link lands here. Signing in takes a click, so link scanners can't use it up. */
export default function VerifyPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className={styles.narrow}>
      <h1>Admin sign-in</h1>
      <Suspense fallback={null}><Confirm searchParams={searchParams} /></Suspense>
    </div>
  );
}

async function Confirm({ searchParams }: { searchParams: SP }) {
  const { t } = await searchParams;
  if (typeof t !== "string" || !t) return <p className={styles.err}>This link is incomplete. <a href="/admin/login">Ask for a new one</a>.</p>;
  return (
    <form className={styles.panel} action={signInWithLink}>
      <input type="hidden" name="t" value={t} />
      <p className={styles.lede}>Continue to sign in. You&apos;ll stay signed in on this browser for 30 days.</p>
      <div className={styles.row}><button className={styles.primary} type="submit">Sign in</button></div>
    </form>
  );
}
