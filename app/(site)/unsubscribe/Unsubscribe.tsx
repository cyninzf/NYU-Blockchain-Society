"use client";

import { useActionState } from "react";
import { changeSubscription, type UnsubState } from "./actions";
import s from "../account.module.css";

/** `invite`: the link came from a one-time invite to a contact (no resubscribe: they were never on a list). */
export default function Unsubscribe({ t, invite = false }: { t: string; invite?: boolean }) {
  const [state, action, pending] = useActionState<UnsubState, FormData>(changeSubscription, null);
  const done = state && "done" in state ? state.done : null;
  return (
    <form action={action} className={s.form}>
      <input type="hidden" name="t" value={t} />
      {done === "unsubscribed" && invite ? (
        <p className={s.ok} role="status">Done. You won&apos;t get another invitation from NYU Blockchain Society.</p>
      ) : done === "unsubscribed" ? (
        <>
          <p className={s.ok} role="status">You&apos;re unsubscribed. We won&apos;t email you again. Your block stays on the chain.</p>
          <p className={s.small}>Changed your mind? <button className={s.link} name="action" value="resubscribe" type="submit" disabled={pending}>Resubscribe</button></p>
        </>
      ) : (
        <>
          {done === "resubscribed" && <p className={s.ok} role="status">You&apos;re subscribed again.</p>}
          <button className="btn btn-w" name="action" value="unsubscribe" type="submit" disabled={pending}>{pending ? "Unsubscribing…" : "Unsubscribe"}</button>
        </>
      )}
      {state && "error" in state && <p className={s.err} role="alert">{state.error}</p>}
    </form>
  );
}
