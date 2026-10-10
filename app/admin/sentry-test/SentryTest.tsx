"use client";

import * as Sentry from "@sentry/nextjs";
import { useActionState, useState } from "react";
import { sendServerTestError, type TestResult } from "./actions";
import styles from "../admin.module.css";

export default function SentryTest() {
  const [server, serverAction, pending] = useActionState<TestResult, FormData>(sendServerTestError, null);
  const [browser, setBrowser] = useState("");
  const sendBrowser = async () => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return setBrowser("Sentry is off in the browser: NEXT_PUBLIC_SENTRY_DSN isn't set for this deployment.");
    const id = Sentry.captureException(new Error("Sentry test error (browser) from /admin/sentry-test"), { tags: { area: "admin", test: "yes" } });
    setBrowser((await Sentry.flush(3000)) ? `Sent. Look for event ${id} in Sentry (tags area:admin, test:yes).` : "Captured, but not confirmed. An ad blocker may block Sentry.");
  };
  return (
    <div className={styles.row} style={{ alignItems: "flex-start", flexDirection: "column" }}>
      <form action={serverAction} className={styles.row}>
        <button type="submit" disabled={pending}>{pending ? "Sending…" : "Send a server test error"}</button>
        <span className={styles.note} role="status">{server?.message}</span>
      </form>
      <div className={styles.row}>
        <button type="button" onClick={sendBrowser}>Send a browser test error</button>
        <span className={styles.note} role="status">{browser}</span>
      </div>
    </div>
  );
}
