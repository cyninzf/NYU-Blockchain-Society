"use client";

import { useEffect, useState } from "react";
import { startJoin } from "@/app/actions/join";
import { submitContact, type ContactResult } from "@/app/actions/contact";
import { TOPIC_LABELS } from "@/content/contact";
import { MSG } from "@/lib/form-errors";
import { CheckedForm, Choice, FormError, TextArea, TextField } from "../forms/Fields";
import { useCheckedForm } from "../forms/useCheckedForm";
import PrivacyNote from "../PrivacyNote";

/** /contact: name, email, topic, message (10 to 1,000 characters). Never cleared on an error. */
export default function ContactForm() {
  const form = useCheckedForm<ContactResult>(submitContact);
  const [token, setToken] = useState("");
  // The signed minimum-fill-time token, as for the join form.
  useEffect(() => { startJoin().then(setToken).catch(() => {}); }, []);

  if (form.state?.ok) {
    return (
      <p className="iq-done" role="status">
        Thank you. We&apos;ve received your message{form.state.privacy
          ? <>. Check your inbox: we&apos;ve sent a link to confirm the request comes from you. We act on privacy requests only once it&apos;s confirmed.</>
          : <> and will reply by email.</>}
      </p>
    );
  }
  return (
    <CheckedForm form={form}>
      <input type="hidden" name="formToken" value={token} />
      <div className="iq-two">
        <TextField label="Name" name="name" autoComplete="name" required maxLength={120} msgRequired={MSG.name} />
        <TextField label="Email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} />
      </div>
      <Choice legend="Topic" name="topic" options={Object.entries(TOPIC_LABELS)} defaultValue="general" msg="Pick a topic." className="picks iq-topics" />
      <TextArea label="Message" name="message" rows={5} required minLength={10} msgRequired={MSG.message(10)} />
      <FormError />
      <button className="btn btn-w" type="submit" disabled={form.pending || !token}>{form.pending ? "Sending…" : "Send"}</button>
      <p className="iq-fine">For a privacy request we&apos;ll first email you a link to confirm it&apos;s you.</p>
      <PrivacyNote />
    </CheckedForm>
  );
}
