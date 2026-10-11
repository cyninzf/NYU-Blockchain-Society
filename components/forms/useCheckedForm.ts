"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { FieldErrors } from "@/lib/form-errors";
import { focusFirstError, validateForm } from "./validate";

export type FormResult = { ok: true } | { ok: false; error: string; fieldErrors?: FieldErrors };

/**
 * A server-action form that never loses what was typed (round 21). It submits from onSubmit
 * (React resets a <form action={…}> after every submit, which blanked the form on a validation
 * error), checks the fields in the browser first, and shows each error, from the browser or the
 * server, next to its field with focus on the first one.
 */
export function useCheckedForm<S extends FormResult>(action: (prev: S | null, fd: FormData) => Promise<S>) {
  const [state, dispatch, pending] = useActionState<S | null, FormData>(action, null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const ref = useRef<HTMLFormElement>(null);
  const id = useId();

  // A new server answer replaces the errors (adjusted while rendering, not in an effect) ...
  const [answered, setAnswered] = useState(state);
  if (state !== answered) {
    setAnswered(state);
    setErrors(state && !state.ok ? state.fieldErrors ?? {} : {});
  }
  // ... and focus moves to the first field it names.
  useEffect(() => {
    if (state && !state.ok && ref.current) focusFirstError(ref.current, state.fieldErrors ?? {});
  }, [state]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fe = validateForm(form);
    setErrors(fe);
    if (Object.keys(fe).length) { focusFirstError(form, fe); return; }
    const fd = new FormData(form);
    startTransition(() => dispatch(fd));
  };
  // An edited field drops its error.
  const onEdit = (e: FormEvent<HTMLFormElement>) => {
    const name = (e.target as HTMLInputElement).name;
    if (name && errors[name]) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== name)));
  };

  const errId = (name: string) => `${id}-${name}-err`;
  /** aria-invalid and aria-describedby for a field (or the first input of a group). */
  const field = (name: string) => (errors[name] ? { "aria-invalid": true as const, "aria-describedby": errId(name) } : {});
  /** Form-level error (rate limit, expired form, server trouble): shown only when no field has one. */
  const formError = state && !state.ok && !Object.keys(errors).length ? state.error : "";

  return { state, pending, errors, field, errId, formError, formProps: { ref, onSubmit, onInput: onEdit, onChange: onEdit, noValidate: true } };
}
