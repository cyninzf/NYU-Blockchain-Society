"use client";

import { useActionState } from "react";
import { savePostalAddress, type SettingsState } from "./actions";
import styles from "../admin.module.css";

export default function AddressForm({ value }: { value: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(savePostalAddress, null);
  return (
    <form action={action} className={`${styles.panel} ${styles.compose}`}>
      <label className={styles.field}>Postal address
        <textarea name="postalAddress" defaultValue={value} rows={3} maxLength={300} placeholder={"Street and number\nCity, State ZIP\nCountry"} />
      </label>
      <p className={styles.note}>Shown at the bottom of every invite and announcement (anti-spam law requires a physical address in bulk email). Invites can&apos;t be sent without it.</p>
      <div className={styles.row}><button type="submit" className={styles.primary} disabled={pending}>{pending ? "Saving…" : "Save"}</button></div>
      <p className={state?.ok === false ? styles.err : styles.note} role="status">{state ? (state.ok ? state.message : state.error) : ""}</p>
    </form>
  );
}
