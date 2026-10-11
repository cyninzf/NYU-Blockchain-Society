"use client";

import { createContext, useContext, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import type { useCheckedForm } from "./useCheckedForm";
import FieldError from "./FieldError";

// Fields for the checked forms (round 21): each field with its error right below it, linked by
// aria-describedby, and the browser-side rules as plain attributes (required, minLength,
// maxLength, type=email) that components/forms/validate.ts reads.

type Form = ReturnType<typeof useCheckedForm>;
const FormCtx = createContext<Form | null>(null);
const useForm = () => useContext(FormCtx)!;

export function CheckedForm({ form, className = "iq-form", children }: { form: Form; className?: string; children: ReactNode }) {
  return <FormCtx.Provider value={form}><form className={className} {...form.formProps}>{children}</form></FormCtx.Provider>;
}

type TextProps = { label: ReactNode; name: string; hint?: ReactNode; required?: boolean; msgRequired?: string; msgShort?: string };

export function TextField({ label, name, hint, msgRequired, msgShort, ...rest }: TextProps & Omit<InputHTMLAttributes<HTMLInputElement>, "name">) {
  const f = useForm();
  return (
    <div className="iq-field">
      <label><span>{label}{hint && <> <span className="iq-hint">{hint}</span></>}</span>
        <input name={name} data-msg-required={msgRequired} data-msg-short={msgShort} {...f.field(name)} {...rest} />
      </label>
      <FieldError id={f.errId(name)} message={f.errors[name]} />
    </div>
  );
}

export function TextArea({ label, name, hint, msgRequired, msgShort, maxLength = 1000, ...rest }: TextProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name">) {
  const f = useForm();
  const [len, setLen] = useState(0);
  return (
    <div className="iq-field">
      <label><span>{label}{hint && <> <span className="iq-hint">{hint}</span></>} <span className="iq-count" aria-live="polite">{len}/{maxLength.toLocaleString("en-US")}</span></span>
        <textarea name={name} maxLength={maxLength} data-msg-required={msgRequired} data-msg-short={msgShort} {...f.field(name)} {...rest} onChange={(e) => setLen(e.target.value.length)} />
      </label>
      <FieldError id={f.errId(name)} message={f.errors[name]} />
    </div>
  );
}

/** Radios (one, required) or checkboxes (`multi`: at least one when `required`). */
export function Choice({ legend, name, options, multi, required = true, msg, defaultValue, className = "picks" }: { legend: ReactNode; name: string; options: [string, string][]; multi?: boolean; required?: boolean; msg?: string; defaultValue?: string; className?: string }) {
  const f = useForm();
  return (
    <fieldset data-required-group={multi && required ? name : undefined} data-msg-required={multi ? msg : undefined} aria-describedby={f.errors[name] ? f.errId(name) : undefined}>
      <legend>{legend}{multi && <span className="iq-hint"> · pick any</span>}</legend>
      <div className={className}>
        {options.map(([v, label], i) => (
          <label key={v} className="iq-pick">
            <input type={multi ? "checkbox" : "radio"} name={name} value={v} required={!multi && required} defaultChecked={v === defaultValue}
              data-msg-required={!multi ? msg : undefined} {...(i === 0 ? f.field(name) : {})} />{label}
          </label>
        ))}
      </div>
      <FieldError id={f.errId(name)} message={f.errors[name]} />
    </fieldset>
  );
}

/** Errors that aren't about one field (too many messages, an expired form): just above the button. */
export function FormError() {
  const f = useForm();
  return <p className="iq-err" role="alert">{f.formError}</p>;
}
