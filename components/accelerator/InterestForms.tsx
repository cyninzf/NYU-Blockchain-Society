"use client";

import { useEffect, useState, type ReactNode } from "react";
import { submitFounder, submitSupporter, type InterestResult } from "@/app/actions/accelerator";
import { startJoin } from "@/app/actions/join";
import { AFFILIATION_LABELS, FOCUS_LABELS, HELP_LABELS, STAGE_LABELS } from "@/content/accelerator";
import { trackEvent } from "@/lib/analytics";
import { MSG } from "@/lib/form-errors";
import { CheckedForm, Choice, FormError, TextArea, TextField } from "../forms/Fields";
import { useCheckedForm } from "../forms/useCheckedForm";
import PrivacyNote from "../PrivacyNote";

const entries = <K extends string>(r: Record<K, string>) => Object.entries(r) as [K, string][];

/** The signed minimum-fill-time token, as for the join form. */
function useFormToken() {
  const [token, setToken] = useState("");
  useEffect(() => { startJoin().then(setToken).catch(() => {}); }, []);
  return token;
}

type Form = ReturnType<typeof useCheckedForm<InterestResult>>;

function Shell({ type, form, token, fine, children }: { type: "accelerator_founder" | "accelerator_supporter"; form: Form; token: string; fine: string; children: ReactNode }) {
  useEffect(() => { if (form.state?.ok) trackEvent("inquiry_submitted", { type }); }, [form.state, type]);
  if (form.state?.ok) return <p className="iq-done" role="status">Thank you. We&apos;ve received your details and will reply by email.</p>;
  return (
    <CheckedForm form={form}>
      <input type="hidden" name="formToken" value={token} />
      {children}
      <FormError />
      <button className="btn btn-w" type="submit" disabled={form.pending || !token}>{form.pending ? "Sending…" : "Send"}</button>
      <p className="iq-fine">{fine}</p>
      <PrivacyNote />
    </CheckedForm>
  );
}

const NameEmail = () => (
  <div className="iq-two">
    <TextField label="Name" name="name" autoComplete="name" required maxLength={120} msgRequired={MSG.name} />
    <TextField label="Email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} />
  </div>
);

/** "I'm a founder": who, the company, stage and focus; optionally also join as a member. Never cleared on an error. */
export function FounderForm() {
  const form = useCheckedForm<InterestResult>(submitFounder);
  const token = useFormToken();
  return (
    <Shell type="accelerator_founder" form={form} token={token} fine="We use these details only to reply about the accelerator. You won't be added to any list unless you tick the box above.">
      <NameEmail />
      <Choice legend="NYU affiliation" name="affiliation" options={entries(AFFILIATION_LABELS)} msg="Pick your NYU affiliation." />
      <div className="iq-two">
        <TextField label="Company name" name="company" autoComplete="organization" required maxLength={120} msgRequired="Add your company's name." />
        {/* Text, not type=url: "example.com" is fine (the server adds https://). */}
        <TextField label="Website" hint="optional" name="url" inputMode="url" autoComplete="url" maxLength={200} placeholder="example.com" />
      </div>
      <TextField label="One-line description" name="oneLiner" required minLength={5} maxLength={160} placeholder="What you're building, in a sentence" msgRequired="Add a one-line description." msgShort="Add a one-line description." />
      <Choice legend="Stage" name="stage" options={entries(STAGE_LABELS)} msg="Pick your stage." />
      <Choice legend="Focus" name="focus" options={entries(FOCUS_LABELS)} multi msg="Pick at least one focus: Blockchain, Finance or AI." />
      <label className="iq-check"><input type="checkbox" name="addMember" /><span>Also add me as a member</span><span className="iq-hint">You&apos;ll join NYU Blockchain Society and hear about the accelerator first.</span></label>
    </Shell>
  );
}

/** "I want to mentor, invest or partner". Never cleared on an error. */
export function SupporterForm() {
  const form = useCheckedForm<InterestResult>(submitSupporter);
  const token = useFormToken();
  return (
    <Shell type="accelerator_supporter" form={form} token={token} fine="We use these details only to reply about the accelerator. You won't be added to any list.">
      <NameEmail />
      <TextField label="Organization" name="organization" autoComplete="organization" required maxLength={120} msgRequired="Add your organization." />
      <Choice legend="How you'd help" name="help" options={entries(HELP_LABELS)} multi msg="Pick at least one way you'd help." />
      <TextArea label="Message" hint="optional" name="message" rows={4} />
    </Shell>
  );
}
