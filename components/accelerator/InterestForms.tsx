"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { submitFounder, submitSupporter, type InterestResult } from "@/app/actions/accelerator";
import { startJoin } from "@/app/actions/join";
import { AFFILIATION_LABELS, FOCUS_LABELS, HELP_LABELS, STAGE_LABELS } from "@/content/accelerator";

import PrivacyNote from "../PrivacyNote";
const entries = <K extends string>(r: Record<K, string>) => Object.entries(r) as [K, string][];

/** The signed minimum-fill-time token, as for the join form, and the honeypot. */
function useFormToken() {
  const [token, setToken] = useState("");
  useEffect(() => { startJoin().then(setToken).catch(() => {}); }, []);
  return token;
}

function Shell({ action, token, pending, state, fine, children }: { action: (fd: FormData) => void; token: string; pending: boolean; state: InterestResult; fine: string; children: ReactNode }) {
  if (state?.ok) return <p className="iq-done" role="status">Thank you. We&apos;ve received your details and will reply by email.</p>;
  return (
    <form action={action} className="iq-form" noValidate>
      <input type="hidden" name="formToken" value={token} />
      {/* Real people never see this field; bots that fill it get a fake thank-you. */}
      <input className="hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {children}
      <button className="btn btn-w" type="submit" disabled={pending || !token}>{pending ? "Sending…" : "Send"}</button>
      <p className="iq-fine">{fine}</p>
      <PrivacyNote />
      <p className="iq-err" role="alert">{state && !state.ok ? state.error : ""}</p>
    </form>
  );
}

function Picks({ legend, name, options, multi }: { legend: string; name: string; options: [string, string][]; multi?: boolean }) {
  return (
    <fieldset>
      <legend>{legend}{multi && <span className="iq-hint"> · pick any</span>}</legend>
      <div className="picks">
        {options.map(([v, label]) => (
          <label key={v} className="iq-pick"><input type={multi ? "checkbox" : "radio"} name={name} value={v} required={!multi} />{label}</label>
        ))}
      </div>
    </fieldset>
  );
}

const NameEmail = () => (
  <div className="iq-two">
    <label>Name<input name="name" autoComplete="name" required maxLength={120} /></label>
    <label>Email<input name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} /></label>
  </div>
);

/** "I'm a founder": who, the company, stage and focus; optionally also join as a member. */
export function FounderForm() {
  const [state, action, pending] = useActionState<InterestResult, FormData>(submitFounder, null);
  const token = useFormToken();
  return (
    <Shell action={action} token={token} pending={pending} state={state} fine="We use these details only to reply about the accelerator. You won't be added to any list unless you tick the box above.">
      <NameEmail />
      <Picks legend="NYU affiliation" name="affiliation" options={entries(AFFILIATION_LABELS)} />
      <div className="iq-two">
        <label>Company name<input name="company" autoComplete="organization" required maxLength={120} /></label>
        {/* Not "website": that name is the honeypot. */}
        <label><span>Website <span className="iq-hint">optional</span></span><input name="url" type="url" inputMode="url" autoComplete="url" maxLength={200} placeholder="example.com" /></label>
      </div>
      <label>One-line description<input name="oneLiner" required maxLength={160} placeholder="What you're building, in a sentence" /></label>
      <Picks legend="Stage" name="stage" options={entries(STAGE_LABELS)} />
      <Picks legend="Focus" name="focus" options={entries(FOCUS_LABELS)} multi />
      <label className="iq-check"><input type="checkbox" name="addMember" /><span>Also add me as a member</span><span className="iq-hint">You&apos;ll join NYU Blockchain Society and hear about the accelerator first.</span></label>
    </Shell>
  );
}

/** "I want to mentor, invest or partner". */
export function SupporterForm() {
  const [state, action, pending] = useActionState<InterestResult, FormData>(submitSupporter, null);
  const token = useFormToken();
  const [len, setLen] = useState(0);
  return (
    <Shell action={action} token={token} pending={pending} state={state} fine="We use these details only to reply about the accelerator. You won't be added to any list.">
      <NameEmail />
      <label>Organization<input name="organization" autoComplete="organization" required maxLength={120} /></label>
      <Picks legend="How you'd help" name="help" options={entries(HELP_LABELS)} multi />
      <label><span>Message <span className="iq-hint">optional</span> <span className="iq-count" aria-live="polite">{len}/1,000</span></span>
        <textarea name="message" rows={4} maxLength={1000} onChange={(e) => setLen(e.target.value.length)} />
      </label>
    </Shell>
  );
}
