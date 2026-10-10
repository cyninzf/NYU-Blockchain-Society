import type { Ref } from "react";
import { HONEYPOT_FIELD } from "@/lib/honeypot";

/**
 * A field real people never see or fill (round 20); a filled one only flags the submission as
 * suspected spam. Put it last in the form, after the submit button, with no text near it. Inside
 * an aria-hidden, tabindex=-1 wrapper; no visible label, only a meaningless aria-label; a meaningless id; an unknown autocomplete token
 * (Chrome ignores "off") and the password-manager ignore attributes. Checked with Chrome's own
 * autofill classifier: it must come out as UNKNOWN_TYPE (test/autofill.mjs in the checklist).
 */
export default function Honeypot({ ref, id = "zq_k4v_0" }: { ref?: Ref<HTMLInputElement>; id?: string }) {
  return (
    <div className="hp" aria-hidden="true" tabIndex={-1}>
      <input
        ref={ref}
        id={id}
        type="text"
        name={HONEYPOT_FIELD}
        defaultValue=""
        tabIndex={-1}
        autoComplete="nope-hp"
        // Without any label Chrome borrows the nearest page text (a heading or intro that says
        // "email" or "company") and fills the field; a meaningless label keeps it UNKNOWN_TYPE.
        aria-label="zq"
        data-1p-ignore=""
        data-lpignore="true"
        data-bwignore="true"
        data-form-type="other"
      />
    </div>
  );
}
