"use client";

import { useActionState } from "react";
import { requestAdminLink, type LinkState } from "./actions";
import styles from "../admin.module.css";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LinkState, FormData>(requestAdminLink, null);
  if (state?.sent) {
    return <p className={styles.note} role="status">If that email belongs to an admin, a sign-in link is on its way. It works once and expires in 15 minutes.</p>;
  }
  return (
    <form className={styles.panel} action={action}>
      <label className={styles.field}>Email
        <input name="email" type="email" autoComplete="email" required autoFocus />
      </label>
      <div className={styles.row}>
        <button className={styles.primary} type="submit" disabled={pending}>{pending ? "Sending…" : "Email me a sign-in link"}</button>
      </div>
      <p className={styles.err} role="alert">{state?.error ?? ""}</p>
    </form>
  );
}
