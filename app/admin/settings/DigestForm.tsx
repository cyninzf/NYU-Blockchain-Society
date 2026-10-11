"use client";

import { useActionState } from "react";
import { saveDigestRecipients, type SettingsState } from "./actions";
import styles from "../admin.module.css";

export default function DigestForm({ value, superEmail }: { value: string; superEmail: string | null }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveDigestRecipients, null);
  return (
    <form action={action} className={`${styles.panel} ${styles.compose}`}>
      <label className={styles.field}>Digest recipients
        <textarea name="digestRecipients" defaultValue={value} rows={3} placeholder={"organizer@example.com"} />
      </label>
      <p className={styles.note}>
        The daily digest (pending spam reviews, verified privacy requests, new members and messages) goes each morning to the super admin{superEmail ? ` (${superEmail})` : ""} and to the organizers listed here, one per line. Only active admins (Team) can be listed. Quiet days send nothing.
      </p>
      <div className={styles.row}><button type="submit" className={styles.primary} disabled={pending}>{pending ? "Saving…" : "Save"}</button></div>
      <p className={state?.ok === false ? styles.err : styles.note} role="status">{state ? (state.ok ? state.message : state.error) : ""}</p>
    </form>
  );
}
