"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { NOTIFY } from "@/content/notify";
import { industries } from "@/content/industries";
import type { Affiliation } from "@/lib/db/schema";
import { updateMember, type EditResult } from "./actions";
import styles from "./admin.module.css";

export type EditableMember = {
  id: number; name: string; email: string; affiliation: Affiliation; blocks: string[]; notify: string[];
  linkedinUrl: string | null; role: string | null; company: string | null; school: string | null; gradYear: number | null; location: string | null;
};

type Props = { m: EditableMember; options: [Affiliation, string][] };

/** Edit every member field. The block number never changes. */
export default function EditMember({ m, options }: Props) {
  const [state, action, pending] = useActionState<EditResult, FormData>(updateMember, null);
  // Submit by hand so a refused edit keeps what was typed (a form `action` would reset it).
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return (
    <form className={styles.edit} onSubmit={submit} noValidate>
      <input type="hidden" name="id" value={m.id} />
      <label>Name<input name="name" defaultValue={m.name} required maxLength={120} autoComplete="off" /></label>
      <label>Email<input name="email" type="email" defaultValue={m.email} required autoComplete="off" /></label>
      <label>Affiliation
        <select name="affiliation" defaultValue={m.affiliation}>
          {options.map(([a, label]) => <option key={a} value={a}>{label}</option>)}
        </select>
      </label>
      <fieldset className={styles.checks}>
        <legend>Blocks</legend>
        {industries.map((i) => <label key={i.id}><input type="checkbox" name="blocks" value={i.id} defaultChecked={m.blocks.includes(i.id)} />{i.name}</label>)}
      </fieldset>
      <fieldset className={styles.checks}>
        <legend>Notify about</legend>
        {NOTIFY.map((n) => <label key={n}><input type="checkbox" name="notify" value={n} defaultChecked={m.notify.includes(n)} />{n}</label>)}
      </fieldset>
      <label>LinkedIn URL<input name="linkedinUrl" type="url" defaultValue={m.linkedinUrl ?? ""} autoComplete="off" /></label>
      <label>Role<input name="role" defaultValue={m.role ?? ""} maxLength={120} autoComplete="off" /></label>
      <label>Company<input name="company" defaultValue={m.company ?? ""} maxLength={120} autoComplete="off" /></label>
      <label>NYU school<input name="school" defaultValue={m.school ?? ""} maxLength={120} autoComplete="off" /></label>
      <label>Grad year<input name="gradYear" inputMode="numeric" maxLength={4} defaultValue={m.gradYear ?? ""} autoComplete="off" /></label>
      <label>City and country<input name="location" defaultValue={m.location ?? ""} maxLength={120} autoComplete="off" /></label>
      <p className={styles.note}>Block #{m.id} stays the same.</p>
      <button type="submit" disabled={pending}>{pending ? "Saving…" : `Save #${m.id}`}</button>
      <p className={state?.ok === false ? styles.err : styles.note} role="status">
        {state ? (state.ok ? state.message : state.error) : ""}
      </p>
    </form>
  );
}
