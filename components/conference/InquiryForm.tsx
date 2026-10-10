"use client";

import { useActionState, useEffect, useState } from "react";
import { submitInquiry, type InquiryResult } from "@/app/actions/inquiry";
import { startJoin } from "@/app/actions/join";

const INTERESTS = [["sponsor", "Sponsor"], ["speak", "Speak"], ["other", "Other"]] as const;

/** "Interested in sponsoring or speaking?" Name, email, company, interest, message (1,000 characters). */
export default function InquiryForm() {
  const [state, action, pending] = useActionState<InquiryResult, FormData>(submitInquiry, null);
  const [token, setToken] = useState("");
  const [len, setLen] = useState(0);
  // The signed minimum-fill-time token, as for the join form.
  useEffect(() => { startJoin().then(setToken).catch(() => {}); }, []);

  if (state?.ok) {
    return <p className="iq-done" role="status">Thank you. We&apos;ve received your note and will reply by email.</p>;
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
      <label>Company<input name="company" autoComplete="organization" maxLength={120} /></label>
      <fieldset>
        <legend>I&apos;m interested in</legend>
        <div className="picks">
          {INTERESTS.map(([v, label]) => (
            <label key={v} className="iq-pick"><input type="radio" name="interest" value={v} required />{label}</label>
          ))}
        </div>
      </fieldset>
      <label>Message <span className="iq-count" aria-live="polite">{len}/1,000</span>
        <textarea name="message" rows={5} maxLength={1000} required onChange={(e) => setLen(e.target.value.length)} />
      </label>
      <button className="btn btn-w" type="submit" disabled={pending || !token}>{pending ? "Sending…" : "Send"}</button>
      <p className="iq-fine">We use these details only to reply about the conference. You won&apos;t be added to any list.</p>
      <p className="iq-err" role="alert">{state && !state.ok ? state.error : ""}</p>
    </form>
  );
}
