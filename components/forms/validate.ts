import { EMAIL_RE, MSG, type FieldErrors } from "@/lib/form-errors";

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * The browser-side check (round 21), read from each field's own attributes: required, minLength,
 * maxLength and type=email, plus fieldsets marked data-required-group for "pick at least one"
 * checkbox groups. Messages come from data-msg-required / data-msg-short, else lib/form-errors.
 * Our own code, not the browser's validation bubbles, so Chrome and Safari behave the same.
 */
export function validateForm(form: HTMLFormElement): FieldErrors {
  const errors: FieldErrors = {};
  const set = (name: string, msg: string) => { if (!errors[name]) errors[name] = msg; };
  for (const el of Array.from(form.elements) as Field[]) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue;
    if (!el.name || el.disabled || el.name === "formToken" || el.name.startsWith("$")) continue;
    if (el instanceof HTMLInputElement && (el.type === "hidden" || el.type === "submit" || el.type === "checkbox")) continue;
    if (el instanceof HTMLInputElement && el.type === "radio") {
      if (el.required && !form.querySelector(`input[type=radio][name="${CSS.escape(el.name)}"]:checked`)) set(el.name, el.dataset.msgRequired ?? MSG.pick);
      continue;
    }
    const v = el.value.trim();
    const min = "minLength" in el ? el.minLength : -1, max = "maxLength" in el ? el.maxLength : -1;
    if (el.required && !v) set(el.name, el.dataset.msgRequired ?? (el.type === "email" ? MSG.email : MSG.required));
    else if (v && el.type === "email" && !EMAIL_RE.test(v)) set(el.name, MSG.email);
    else if (v && min > 0 && v.length < min) set(el.name, el.dataset.msgShort ?? MSG.message(min));
    else if (max > 0 && v.length > max) set(el.name, MSG.tooLong(max));
  }
  for (const fs of Array.from(form.querySelectorAll<HTMLFieldSetElement>("fieldset[data-required-group]"))) {
    const name = fs.dataset.requiredGroup!;
    if (!fs.querySelector("input[type=checkbox]:checked")) set(name, fs.dataset.msgRequired ?? MSG.pickAny);
  }
  return errors;
}

/** Focus (and bring into view) the first field with an error, in the order the form shows them. */
export function focusFirstError(form: HTMLFormElement, errors: FieldErrors) {
  const names = Object.keys(errors);
  if (!names.length) return;
  const first = (Array.from(form.elements) as Field[]).find((el) => names.includes(el.name))
    ?? form.querySelector<HTMLElement>(names.map((n) => `fieldset[data-required-group="${CSS.escape(n)}"] input`).join(","));
  if (!first) return;
  first.focus({ preventScroll: true });
  first.scrollIntoView({ block: "center", behavior: "auto" });
}
