"use client";

import { useEffect, useState } from "react";
import { submitInquiry, type InquiryResult } from "@/app/actions/inquiry";
import { startJoin } from "@/app/actions/join";
import { trackEvent } from "@/lib/analytics";
import { MSG } from "@/lib/form-errors";
import { CheckedForm, Choice, FormError, TextArea, TextField } from "../forms/Fields";
import { useCheckedForm } from "../forms/useCheckedForm";
import PrivacyNote from "../PrivacyNote";

const INTERESTS: [string, string][] = [["sponsor", "Sponsor"], ["speak", "Speak"], ["other", "Other"]];

/** "Interested in sponsoring or speaking?" Name, email, company, interest, message. Never cleared on an error. */
export default function InquiryForm() {
  const form = useCheckedForm<InquiryResult>(submitInquiry);
  const [token, setToken] = useState("");
  // The signed minimum-fill-time token, as for the join form.
  useEffect(() => { startJoin().then(setToken).catch(() => {}); }, []);
  useEffect(() => { if (form.state?.ok) trackEvent("inquiry_submitted", { type: "conference" }); }, [form.state]);

  if (form.state?.ok) return <p className="iq-done" role="status">Thank you. We&apos;ve received your note and will reply by email.</p>;
  return (
    <CheckedForm form={form}>
      <input type="hidden" name="formToken" value={token} />
      <div className="iq-two">
        <TextField label="Name" name="name" autoComplete="name" required maxLength={120} msgRequired={MSG.name} />
        <TextField label="Email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} />
      </div>
      <TextField label="Company" name="company" autoComplete="organization" maxLength={120} />
      <Choice legend="I'm interested in" name="interest" options={INTERESTS} msg="Pick Sponsor, Speak or Other." />
      <TextArea label="Message" name="message" rows={5} required minLength={10} msgRequired={MSG.message(10)} />
      <FormError />
      <button className="btn btn-w" type="submit" disabled={form.pending || !token}>{form.pending ? "Sending…" : "Send"}</button>
      <p className="iq-fine">We use these details only to reply about the conference. You won&apos;t be added to any list.</p>
      <PrivacyNote />
    </CheckedForm>
  );
}
