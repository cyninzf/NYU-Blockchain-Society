"use client";

import { useActionState, useEffect, useState } from "react";
import { startJoin } from "@/app/actions/join";
import { submitContact, type ContactResult } from "@/app/actions/contact";
import { TOPIC_LABELS } from "@/content/contact";
import type { ContactTopic } from "@/lib/db/schema";
import PrivacyNote from "../PrivacyNote";

const TOPICS = Object.entries(TOPIC_LABELS) as [ContactTopic, string][];

/** /contact: name, email, topic, message (1,000 characters). */
export default function ContactForm() {
  const [state, action, pending] = useActionState<ContactResult, FormData>(submitContact, null);
  const [token, setToken] = useState("");
  const [len, setLen] = useState(0);
  // The signed minimum-fill-time token, as for the join form.
  useEffect(() => { startJoin().then(setToken).catch(() => {}); }, []);

  if (state?.ok) {
    return (
      <p className="iq-done" role="status">
        Thank you. We&apos;ve received your message{state.privacy
          ? <>. Check your inbox: we&apos;ve sent a link to confirm the request comes from you. We act on privacy requests only once it&apos;s confirmed.</>
          : <> and will reply by email.</>}
      </p>
    );
  }
  return (
    <form action={action} className="iq-form" noValidate>
      <input type="hidden" name="formToken" value={token} />
      {/* Real people never see this field; bots that fill it get a fake thank-you. */}
      <input className="hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="iq-two">
        <label>Name<input name="name" autoComplete="name" required maxLength={120} /></label>
        <label>Email<input name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} /></label>
      </div>
      <fieldset>
        <legend>Topic</legend>
        <div className="picks iq-topics">
          {TOPICS.map(([v, label]) => (
            <label key={v} className="iq-pick"><input type="radio" name="topic" value={v} required defaultChecked={v === "general"} />{label}</label>
          ))}
        </div>
      </fieldset>
      <label><span>Message <span className="iq-count" aria-live="polite">{len}/1,000</span></span>
        <textarea name="message" rows={5} maxLength={1000} required onChange={(e) => setLen(e.target.value.length)} />
      </label>
      <button className="btn btn-w" type="submit" disabled={pending || !token}>{pending ? "Sending…" : "Send"}</button>
      <p className="iq-fine">For a privacy request we&apos;ll first email you a link to confirm it&apos;s you.</p>
      <PrivacyNote />
      <p className="iq-err" role="alert">{state && !state.ok ? state.error : ""}</p>
    </form>
  );
}
