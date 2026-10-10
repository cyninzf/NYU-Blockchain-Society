"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { saveEvent, type EventFormResult } from "./actions";
import styles from "../admin.module.css";

/** Form values: times as datetime-local strings in New York time. */
export type EventFormValues = {
  id?: number; title: string; kind: string; slug: string; startsAt: string; endsAt: string; venueName: string;
  address: string; description: string; registrationUrl: string; cohost: string;
};

export const EMPTY_EVENT: EventFormValues = { title: "", kind: "", slug: "", startsAt: "", endsAt: "", venueName: "", address: "", description: "", registrationUrl: "", cohost: "" };

export default function EventForm({ e }: { e: EventFormValues }) {
  const [state, action, pending] = useActionState<EventFormResult, FormData>(saveEvent, null);
  // Submit by hand so a refused save keeps what was typed (a form `action` would reset it).
  const submit = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    startTransition(() => action(fd));
  };
  return (
    <form className={`${styles.panel} ${styles.compose}`} onSubmit={submit} noValidate>
      {e.id && <input type="hidden" name="id" value={e.id} />}
      <label className={styles.field}>Title<input name="title" defaultValue={e.title} required maxLength={140} autoComplete="off" /></label>
      <label className={styles.field}>Label above the title (optional)<input name="kind" defaultValue={e.kind} maxLength={40} autoComplete="off" placeholder="e.g. Networking evening (shows “Event” if empty)" /></label>
      <div className={styles.row}>
        <label className={styles.field}>Starts (New York time)<input name="startsAt" type="datetime-local" defaultValue={e.startsAt} required /></label>
        <label className={styles.field}>Ends (optional)<input name="endsAt" type="datetime-local" defaultValue={e.endsAt} /></label>
      </div>
      <label className={styles.field}>Venue<input name="venueName" defaultValue={e.venueName} maxLength={140} autoComplete="off" placeholder="e.g. KPMG New York office" /></label>
      <label className={styles.field}>Address<input name="address" defaultValue={e.address} maxLength={200} autoComplete="off" /></label>
      <label className={styles.field}>Short description (plain text)<textarea name="description" defaultValue={e.description} maxLength={600} rows={4} /></label>
      <label className={styles.field}>Registration link<input name="registrationUrl" type="url" defaultValue={e.registrationUrl} maxLength={500} autoComplete="off" placeholder="https://lu.ma/…" /></label>
      <label className={styles.field}>Co-host (optional, text only)<input name="cohost" defaultValue={e.cohost} maxLength={80} autoComplete="off" placeholder="e.g. KPMG" /></label>
      <label className={styles.field}>Link name (optional)<input name="slug" defaultValue={e.slug} maxLength={34} autoComplete="off" placeholder="made from the title if empty" pattern="[a-z0-9-]*" /></label>
      <p className={styles.note}>The link name sets the event page (/events/<i>link-name</i>) and the share link (?src=event-<i>link-name</i>). Changing it after sharing breaks those links.</p>
      <div className={styles.row}>
        <button type="submit" className={styles.primary} disabled={pending}>{pending ? "Saving…" : e.id ? "Save" : "Create draft"}</button>
      </div>
      <p className={state?.ok === false ? styles.err : styles.note} role="status">{state ? (state.ok ? state.message : state.error) : ""}</p>
    </form>
  );
}
