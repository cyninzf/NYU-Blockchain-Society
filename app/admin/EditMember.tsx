"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { Affiliation } from "@/lib/db/schema";
import { updateMember, type EditResult } from "./actions";
import styles from "./admin.module.css";

type Props = { id: number; name: string; email: string; affiliation: Affiliation; options: [Affiliation, string][] };

/** Edit name, email and affiliation. The block number never changes. */
export default function EditMember({ id, name, email, affiliation, options }: Props) {
  const [state, action, pending] = useActionState<EditResult, FormData>(updateMember, null);
  // Submit by hand so a refused edit keeps what was typed (a form `action` would reset it).
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return (
    <form className={styles.edit} onSubmit={submit} noValidate>
      <input type="hidden" name="id" value={id} />
      <label>Name<input name="name" defaultValue={name} required maxLength={120} autoComplete="off" /></label>
      <label>Email<input name="email" type="email" defaultValue={email} required autoComplete="off" /></label>
      <label>Affiliation
        <select name="affiliation" defaultValue={affiliation}>
          {options.map(([a, label]) => <option key={a} value={a}>{label}</option>)}
        </select>
      </label>
      <p className={styles.note}>Block #{id} stays the same.</p>
      <button type="submit" disabled={pending}>{pending ? "Saving…" : `Save #${id}`}</button>
      <p className={state?.ok === false ? styles.err : styles.note} role="status">
        {state ? (state.ok ? state.message : state.error) : ""}
      </p>
    </form>
  );
}
