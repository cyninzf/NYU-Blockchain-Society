import type { Ref } from "react";
import { HONEYPOT_FIELD } from "@/lib/honeypot";

/**
 * A field real people never see or fill; bots that fill it get a fake success (round 20). Off
 * screen, out of the tab order, hidden from screen readers, and marked for 1Password, LastPass,
 * Bitwarden and Dashlane to skip, so autofill can't fill it for a person.
 */
export default function Honeypot({ ref }: { ref?: Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      className="hp"
      type="text"
      name={HONEYPOT_FIELD}
      defaultValue=""
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      data-1p-ignore=""
      data-lpignore="true"
      data-bwignore="true"
      data-form-type="other"
    />
  );
}
