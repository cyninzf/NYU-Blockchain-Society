import type { Metadata } from "next";
import { Suspense } from "react";
import Guard from "../Guard";
import styles from "../admin.module.css";
import SentryTest from "./SentryTest";

export const metadata: Metadata = { title: "Sentry test · Admin", robots: { index: false, follow: false } };

// Super admins only (round 16): check that error monitoring works, from the server and the browser.
export default function SentryTestPage() {
  return (
    <>
      <h1>Sentry test</h1>
      <p className={styles.lede}>Sends one harmless test error to Sentry, tagged area:admin and test:yes, with no personal data. Use it after setting the Sentry environment variables in Vercel. Each server test is logged in the audit log.</p>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard min="super_admin">{() => <SentryTest />}</Guard>
      </Suspense>
    </>
  );
}
