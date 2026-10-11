"use client";

import { useActionState } from "react";
import { sendWelcomeTest, type SettingsState } from "./actions";
import styles from "../admin.module.css";

/** One button per automatic email: sends it, as recipients see it, to the signed-in super admin. */
function TestButton({ label, action }: { label: string; action: (prev: SettingsState) => Promise<SettingsState> }) {
  const [state, run, pending] = useActionState<SettingsState>(action, null);
  return (
    <form action={run}>
      <div className={styles.row}><button type="submit" disabled={pending}>{pending ? "Sending…" : label}</button></div>
      <p className={state?.ok === false ? styles.err : styles.note} role="status">{state ? (state.ok ? state.message : state.error) : ""}</p>
    </form>
  );
}

export default function TestEmails() {
  return (
    <section className={styles.panel} aria-labelledby="test-emails-h">
      <h2 id="test-emails-h">Test emails</h2>
      <p className={styles.note}>Sends to you only, marked [Test]. Counts toward today&apos;s email limit.</p>
      <TestButton label="Send test welcome email to me" action={sendWelcomeTest} />
    </section>
  );
}
