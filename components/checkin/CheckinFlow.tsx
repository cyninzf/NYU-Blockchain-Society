"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { checkinJoin, checkInSelf, requestCheckin, type CheckinResult } from "@/app/actions/checkin";
import { startJoin } from "@/app/actions/join";
import CheckinDone from "./CheckinDone";

import PrivacyNote from "../PrivacyNote";
import { MSG, type FieldErrors } from "@/lib/form-errors";
import FieldError from "../forms/FieldError";
import { focusFirstError, validateForm } from "../forms/validate";
const YOU = [["alumni", "Alumni"], ["industry", "Industry professional"], ["faculty_staff", "Faculty/Staff"], ["student", "Student"]] as const;
const JOINED_BEFORE = "Joined before with this email? Tap the link we just emailed you to finish checking in.";

/** With a member session: one button. */
export function CheckinSelf({ slug, firstName, test = false }: { slug: string; firstName: string; test?: boolean }) {
  const [res, setRes] = useState<CheckinResult | null>(null);
  const [busy, setBusy] = useState(false);
  if (res?.ok) return <CheckinDone n={res.n} />;
  return (
    <div className="ci-step">
      <button className="btn btn-w" disabled={busy} onClick={async () => {
        setBusy(true);
        try { setRes(await checkInSelf(slug, test)); } catch { setRes({ ok: false, error: "Couldn't check you in. Please try again." }); } finally { setBusy(false); }
      }}>{busy ? "Checking in…" : `Check in as ${firstName}`}</button>
      <p className="ci-err" role="alert">{res && !res.ok ? res.error : ""}</p>
    </div>
  );
}

/**
 * Without a session: email first (members get a one-tap link), then a short join form for new
 * people. `test`: test mode, where the join form creates nothing unless "Create a real member" is ticked.
 */
export default function CheckinFlow({ slug, test = false }: { slug: string; test?: boolean }) {
  const [email, setEmail] = useState("");
  const [asked, setAsked] = useState(false);
  const [token, setToken] = useState("");
  const [done, setDone] = useState<CheckinResult | null>(null);
  const [err, setErr] = useState("");
  // Field errors next to their fields (round 21), from the browser check or the server.
  const [fieldErrs, setFieldErrs] = useState<FieldErrors>({});
  const id = useId();
  const errId = (n: string) => `${id}-${n}-err`;
  const fieldA11y = (n: string) => (fieldErrs[n] ? { "aria-invalid": true as const, "aria-describedby": errId(n) } : {});
  const clearOnEdit = (e: FormEvent<HTMLFormElement>) => { const n = (e.target as HTMLInputElement).name; if (n && fieldErrs[n]) setFieldErrs((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== n))); };
  /** Browser-side check first; on errors, show them and focus the first. */
  const check = (form: HTMLFormElement) => { const fe = validateForm(form); setFieldErrs(fe); if (Object.keys(fe).length) { focusFirstError(form, fe); return false; } return true; };
  const serverErrors = (form: HTMLFormElement, fe: FieldErrors | undefined, error: string) => {
    if (fe && Object.keys(fe).length) { setFieldErrs(fe); setErr(""); focusFirstError(form, fe); } else setErr(error);
  };
  const [busy, setBusy] = useState(false);

  // The join form's minimum-fill-time token, issued once the form appears.
  useEffect(() => { if (asked && !token) startJoin().then(setToken).catch(() => {}); }, [asked, token]);

  async function onEmail(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    setErr("");
    if (!check(form)) return;
    setBusy(true);
    try {
      const r = await requestCheckin(slug, email, test);
      if (!r.ok) return serverErrors(form, r.fieldErrors, r.error);
      setAsked(true);
    } catch { setErr("Something went wrong. Please try again."); } finally { setBusy(false); }
  }

  async function onJoin(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const fd = new FormData(form);
    const submitter = (ev.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const affiliation = YOU.find(([v]) => v === submitter?.value)?.[0];
    setErr("");
    if (!check(form)) return;
    if (!affiliation) return setErr("Pick the one that fits best.");
    setBusy(true);
    try {
      const r = await checkinJoin({
        slug, formToken: token, name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""), affiliation,
        test, createReal: test && fd.get("createReal") === "on",
      });
      if (!r.ok) return serverErrors(form, r.fieldErrors, r.error);
      setDone(r);
    } catch { setErr("Something went wrong. Please try again."); } finally { setBusy(false); }
  }

  if (done?.ok && done.fake) return <CheckinDone n={null} note="Test mode: nothing was created and no one was checked in. Tick “Create a real member” to test a real join." />;
  if (done?.ok) return <CheckinDone n={done.n} note={JOINED_BEFORE} />;

  if (!asked) {
    return (
      <form className="ci-step" onSubmit={onEmail} onInput={clearOnEdit} noValidate>
        <label>Your email<input type="email" name="email" autoComplete="email" inputMode="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} {...fieldA11y("email")} /></label>
        <FieldError id={errId("email")} message={fieldErrs.email} />
        <button className="btn btn-w" type="submit" disabled={busy}>{busy ? "One moment…" : "Continue"}</button>
        <p className="ci-err" role="alert">{err}</p>
        <PrivacyNote />
      </form>
    );
  }

  return (
    <form className="ci-step" onSubmit={onJoin} onInput={clearOnEdit} noValidate>
      <p className="ci-note" role="status">Already a member? Check your inbox: we&apos;ve emailed you a one-tap check-in link. New here? Add your block to check in.</p>
      <label>Name<input name="name" autoComplete="name" required maxLength={120} data-msg-required={MSG.name} {...fieldA11y("name")} /></label>
      <FieldError id={errId("name")} message={fieldErrs.name} />
      <label>Email<input name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} defaultValue={email} {...fieldA11y("email")} /></label>
      <FieldError id={errId("email")} message={fieldErrs.email} />
      <fieldset>
        <legend>You are…</legend>
        <div className="picks you">
          {YOU.map(([v, label]) => <button key={v} type="submit" name="affiliation" value={v} className="pick" disabled={busy || !token}>{label}</button>)}
        </div>
      </fieldset>
      {test && (
        <label className="ci-check"><input type="checkbox" name="createReal" />Create a real member (test mode: off by default, so nothing is created)</label>
      )}
      <p className="ci-fine">By joining, organizers may email you about events and programs. Unsubscribe anytime. Only organizers see your details.</p>
      <p className="ci-err" role="alert">{err}</p>
      <PrivacyNote />
    </form>
  );
}
