"use client";

import { useActionState } from "react";
import { NOTIFY } from "@/content/notify";
import { industries } from "@/content/industries";
import { saveOwnBlock, type SaveState } from "../actions";
import s from "../../account.module.css";

import PrivacyNote from "@/components/PrivacyNote";
export type OwnBlock = {
  blocks: string[]; notify: string[]; linkedinUrl: string | null; role: string | null; company: string | null;
  school: string | null; gradYear: number | null; location: string | null;
};

const NOTIFY_LABELS: Record<string, string> = { networking: "Networking events", accelerator: "The accelerator", conference: "The next conference" };

export default function EditBlock({ b }: { b: OwnBlock }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveOwnBlock, null);
  return (
    <form action={action} className={s.form} noValidate>
      <fieldset>
        <legend>Your blocks</legend>
        {industries.map((i) => <label key={i.id}><input type="checkbox" name="blocks" value={i.id} defaultChecked={b.blocks.includes(i.id)} />{i.name}</label>)}
      </fieldset>
      <fieldset>
        <legend>Email me about</legend>
        {NOTIFY.map((n) => <label key={n}><input type="checkbox" name="notify" value={n} defaultChecked={b.notify.includes(n)} />{NOTIFY_LABELS[n] ?? n}</label>)}
      </fieldset>
      <label>LinkedIn profile URL<input name="linkedinUrl" type="url" inputMode="url" autoComplete="url" placeholder="linkedin.com/in/..." defaultValue={b.linkedinUrl ?? ""} /></label>
      <div className={s.two}>
        <label>Role<input name="role" autoComplete="organization-title" maxLength={120} defaultValue={b.role ?? ""} /></label>
        <label>Company<input name="company" autoComplete="organization" maxLength={120} defaultValue={b.company ?? ""} /></label>
      </div>
      <div className={s.two}>
        <label>NYU school<input name="school" placeholder="e.g. Stern" maxLength={120} defaultValue={b.school ?? ""} /></label>
        <label>Grad year<input name="gradYear" inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="YYYY" defaultValue={b.gradYear ?? ""} /></label>
      </div>
      <label>City and country<input name="location" maxLength={120} placeholder="e.g. Lisbon, Portugal" defaultValue={b.location ?? ""} /></label>
      <div className={s.actions}>
        <button className="btn btn-w" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <span className={state && !state.ok ? s.err : s.small} role="status">{state ? (state.ok ? "Saved." : state.error) : ""}</span>
      </div>
      <PrivacyNote />
    </form>
  );
}
