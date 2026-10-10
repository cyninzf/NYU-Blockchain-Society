"use client";

import { useActionState } from "react";
import CopyButton from "@/components/CopyButton";
import { makeDisplayLink, type DisplayLinkResult } from "../actions";
import styles from "../../admin.module.css";

/** "Create display link": the URL appears once, here, to copy onto the screen's browser. */
export default function DisplayLinkForm({ id }: { id: number }) {
  const [state, action, pending] = useActionState<DisplayLinkResult, FormData>(makeDisplayLink, null);
  return (
    <form action={action} className={styles.edit}>
      <input type="hidden" name="id" value={id} />
      <div className={styles.row}><button type="submit" disabled={pending}>{pending ? "Creating…" : "Create display link"}</button></div>
      {state?.ok && (
        <div className={styles.share} role="status">
          <code>{state.url}</code>
          <CopyButton text={state.url} label="Copy the display link" />
          <p className={styles.note}>Shown once: copy it now. It opens only this event&apos;s live screen, only while check-in is open.</p>
        </div>
      )}
      {state && !state.ok && <p className={styles.err} role="alert">{state.error}</p>}
    </form>
  );
}
