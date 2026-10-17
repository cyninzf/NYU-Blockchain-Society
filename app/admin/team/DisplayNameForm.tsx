"use client";

import { useActionState } from "react";
import { saveDisplayName, type TeamResult } from "./actions";
import styles from "../admin.module.css";

/** One organizer's display name (round 28.1): quick-add's default source becomes via-<name>. */
export default function DisplayNameForm({ id, recovery, current, who }: { id?: number; recovery?: boolean; current: string | null; who: string }) {
  const [state, action, pending] = useActionState<TeamResult, FormData>(saveDisplayName, null);
  return (
    <form className={styles.row} action={action}>
      {recovery ? <input type="hidden" name="recovery" value="1" /> : <input type="hidden" name="id" value={id} />}
      <input name="displayName" defaultValue={current ?? ""} maxLength={40} placeholder="e.g. Fang" aria-label={`Display name for ${who}`} autoComplete="off" />
      <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      {state && <span className={state.ok ? styles.note : styles.err} role="status">{state.ok ? state.message : state.error}</span>}
    </form>
  );
}
