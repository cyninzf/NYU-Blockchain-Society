"use client";

import { useActionState } from "react";
import { requestMemberLink, type LinkState } from "./actions";
import s from "../account.module.css";

import PrivacyNote from "@/components/PrivacyNote";
export default function RequestLink() {
  const [state, action, pending] = useActionState<LinkState, FormData>(requestMemberLink, null);
  if (state?.sent) {
    return <p className={s.ok} role="status">If that email is on the chain, we&apos;ve sent it a link to update your block. It works once and expires in 15 minutes.</p>;
  }
  return (
    <form action={action} className={s.form} noValidate>
      <label>Email you joined with
        <input name="email" type="email" inputMode="email" autoComplete="email" required />
      </label>
      <div className={s.actions}><button className="btn btn-w" type="submit" disabled={pending}>{pending ? "Sending…" : "Email me a link"}</button></div>
      {state && !state.sent && <p className={s.err} role="alert">{state.error}</p>}
      <PrivacyNote />
    </form>
  );
}
