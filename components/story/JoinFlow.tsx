"use client";

// "Add your block": one question per step, Enter advances, Back is always available.
// Each completed step draws a node in the hero visual; on success the block snaps onto the chain.

import { useEffect, useRef, useState, type FormEvent } from "react";
import { inviteEmail, join, saveDetails, startJoin, type SaveResult } from "@/app/actions/join";
import { NOTIFY, notifyMessages, type Notify } from "@/content/notify";
import { industries } from "@/content/industries";
import { privacyLine } from "@/content/site";
import { clearInvite, joinSource, storedInvite } from "@/lib/join-source";
import type { Affiliation } from "@/lib/db/schema";
import Icon from "../Icon";
import CalendarButtons from "../events/CalendarButtons";
import type { JoinEvent } from "@/app/api/events/[slug]/route";

const STEPS = ["blocks", "name", "email", "you"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const YOU: [Exclude<Affiliation, "friend">, string][] = [
  ["alumni", "Alumni"],
  ["industry", "Industry professional"],
  ["faculty_staff", "Faculty/Staff"],
  ["student", "Student"],
];

type Props = {
  sel: number[];
  toggle: (i: number) => void;
  notify?: Notify;
  onProgress: (steps: number) => void;
  onJoined: (name: string) => void;
  onClose: () => void;
};

type Done = { n: number | null; token: string | null; devNotice?: string; notify?: Notify };

export default function JoinFlow({ sel, toggle, notify, onProgress, onJoined, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // Arrived from an invite: pre-fill the address it was sent to (still editable).
  useEffect(() => {
    const t = storedInvite();
    if (t) inviteEmail(t).then((e) => { if (e) setEmail((cur) => cur || e); }).catch(() => {});
  }, []);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const formToken = useRef<Promise<string> | null>(null);
  const stepRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  useEffect(() => { formToken.current = startJoin(); }, []);

  // Phones: when the on-screen keyboard opens, keep the focused field in view above it.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement && el.closest(".jf, .jf-done")) el.scrollIntoView({ block: "center" });
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => { onProgress(done ? 0 : step); }, [step, done, onProgress]);

  // Focus the current question (or the success heading) whenever it changes.
  useEffect(() => {
    if (done) { doneRef.current?.focus({ preventScroll: true }); return; }
    stepRef.current?.querySelector<HTMLElement>("input, button")?.focus({ preventScroll: true });
  }, [step, done]);

  const back = () => { setErr(""); if (step === 0) onClose(); else setStep(step - 1); };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    setErr("");
    const id = STEPS[step];
    if (id === "name" && !name.trim()) { setErr("Add your name."); return; }
    if (id === "email" && !EMAIL_RE.test(email.trim())) { setErr("Enter an email we can reach you at, like name@example.com."); return; }
    if (id !== "you") { setStep(step + 1); return; }

    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const affiliation = YOU.find(([v]) => v === submitter?.value)?.[0];
    if (!affiliation) { setErr("Pick the one that fits best."); return; }

    const params = new URLSearchParams(window.location.search);
    const src = joinSource();
    const urlNotify = params.get("notify");
    const n = notify ?? (NOTIFY.includes(urlNotify as Notify) ? (urlNotify as Notify) : undefined);

    setSending(true);
    try {
      const res = await join({
        formToken: (await formToken.current) ?? "",
        website: honeypot.current?.value ?? "",
        blocks: [...sel].sort().map((i) => industries[i].id),
        name: name.trim(),
        email: email.trim(),
        affiliation,
        notify: n,
        src,
        invite: storedInvite(),
      });
      if (!res.ok) { setErr(res.error); return; }
      clearInvite();
      setDone({ n: res.n, token: res.token, devNotice: res.devNotice, notify: n });
      onJoined(name.trim());
    } catch {
      setErr("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  if (done) return <Success done={done} headingRef={doneRef} onClose={onClose} />;

  const id = STEPS[step];
  return (
    <form className="jf" noValidate onSubmit={submit} aria-labelledby="jf-q">
      <div className="jf-top">
        <button className="link" type="button" onClick={back}>{step === 0 ? "Cancel" : <><Icon name="arrow-left" /> Back</>}</button>
        <span className="mono jf-step" aria-hidden="true">
          {STEPS.map((s, i) => <i key={s} className={i < step ? "past" : i === step ? "now" : ""} />)}
        </span>
        <span className="sr" aria-live="polite">Step {step + 1} of {STEPS.length}</span>
      </div>

      {/* Real people never see this field; bots that fill it get a fake success. */}
      <div className="hp" aria-hidden="true">
        <label>Website<input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className="jf-step-body" ref={stepRef} key={id}>
        {id === "blocks" && (
          <fieldset>
            <legend id="jf-q">Which blocks do you work in?<span>Pick any, or tap them in the logo.</span></legend>
            <div className="picks">
              {industries.map((ind, i) => (
                <button key={ind.id} className="pick" type="button" aria-pressed={sel.includes(i)} onClick={() => toggle(i)}>
                  {ind.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {id === "name" && (
          <label className="q" htmlFor="jf-name">
            <span id="jf-q">What&apos;s your name?</span>
            <input id="jf-name" name="name" autoComplete="name" enterKeyHint="next" required value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!err} aria-describedby="jf-err" />
          </label>
        )}
        {id === "email" && (
          <label className="q" htmlFor="jf-email">
            <span id="jf-q">And your email?</span>
            <input id="jf-email" name="email" type="email" autoComplete="email" inputMode="email" enterKeyHint="next" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!err} aria-describedby="jf-err" />
          </label>
        )}
        {id === "you" && (
          <fieldset disabled={sending}>
            <legend id="jf-q">You are…</legend>
            <div className="picks you">
              {YOU.map(([value, label]) => (
                <button key={value} className="pick" type="submit" name="affiliation" value={value}>{label}</button>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      {id !== "you" && (
        <div className="actions">
          <button className="btn btn-w" type="submit">{id === "blocks" && !sel.length ? "Skip" : "Next"}</button>
        </div>
      )}
      <p className="err" id="jf-err" role="alert">{sending ? "" : err}</p>
      {id === "you" && <p className="fine">{sending ? "Adding your block…" : privacyLine}</p>}
    </form>
  );
}

/** Joined from an event's share link (?src=event-<slug>): that event, if it's published and upcoming. */
function useJoinEvent() {
  const [ev, setEv] = useState<JoinEvent | null>(null);
  useEffect(() => {
    const slug = /^event-([a-z0-9-]{1,40})$/.exec(joinSource() ?? "")?.[1];
    if (!slug) return;
    let alive = true;
    fetch(`/api/events/${slug}`).then((r) => (r.ok ? r.json() : null)).then((j: JoinEvent | null) => { if (alive && j?.title) setEv(j); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return ev;
}

function Success({ done, headingRef, onClose }: { done: Done; headingRef: React.RefObject<HTMLHeadingElement | null>; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const ev = useJoinEvent();
  const save = (input: Parameters<typeof saveDetails>[1]) => saveDetails(done.token ?? "", input);
  return (
    <div className="jf-done">
      <h2 ref={headingRef} tabIndex={-1}>
        {done.n ? <>Block #{done.n} added.</> : <>Block added.</>} You&apos;re on the chain.
      </h2>
      {done.notify && <p>{notifyMessages[done.notify]}</p>}
      {ev && (
        <div className="jf-event">
          <p>You&apos;re on the list for <b>{ev.title}</b> · {ev.when}</p>
          <CalendarButtons links={ev.calendar} />
          {ev.registrationUrl && <p><a className="btn btn-w" href={ev.registrationUrl} target="_blank" rel="noopener">Register <Icon name="arrow-up-right" /><span className="sr"> (opens in a new tab)</span></a></p>}
        </div>
      )}
      {done.devNotice && <p className="dev">{done.devNotice}</p>}
      {open ? (
        <div className="more">
          <h3>Strengthen your block <span>Optional. Each part saves on its own.</span></h3>
          <Detail label="LinkedIn profile" onSave={(fd) => save({ kind: "linkedin", linkedinUrl: String(fd.get("linkedinUrl") ?? "") })}>
            <label>LinkedIn profile URL<input name="linkedinUrl" type="url" inputMode="url" autoComplete="url" placeholder="linkedin.com/in/..." /></label>
          </Detail>
          <Detail label="Role and company" onSave={(fd) => save({ kind: "work", role: String(fd.get("role") ?? ""), company: String(fd.get("company") ?? "") })}>
            <div className="two">
              <label>Role<input name="role" autoComplete="organization-title" /></label>
              <label>Company<input name="company" autoComplete="organization" /></label>
            </div>
          </Detail>
          <Detail label="NYU school and grad year" onSave={(fd) => save({ kind: "school", school: String(fd.get("school") ?? ""), gradYear: String(fd.get("gradYear") ?? "") })}>
            <div className="two">
              <label>NYU school<input name="school" placeholder="e.g. Stern" /></label>
              <label>Grad year<input name="gradYear" inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="YYYY" /></label>
            </div>
          </Detail>
          <Detail label="City and country" onSave={(fd) => save({ kind: "location", location: String(fd.get("location") ?? "") })}>
            <label>City and country<input name="location" autoComplete="off" maxLength={120} placeholder="e.g. Lisbon, Portugal" /></label>
          </Detail>
          <div className="actions"><button className="link" type="button" onClick={() => setOpen(false)}>Done</button></div>
        </div>
      ) : (
        <div className="actions"><p>All set. Thanks for adding your block.</p><button className="link" type="button" onClick={onClose}>Close</button></div>
      )}
    </div>
  );
}

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; note?: string } | { kind: "error"; msg: string };

function useSave(onSave: () => Promise<SaveResult>) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const run = async () => {
    setStatus({ kind: "saving" });
    try {
      const r = await onSave();
      setStatus(r.ok ? { kind: "saved", note: r.devNotice } : { kind: "error", msg: r.error });
    } catch {
      setStatus({ kind: "error", msg: "We couldn't reach the server. Try again." });
    }
  };
  return [status, run, () => setStatus({ kind: "idle" })] as const;
}

function StatusLine({ status }: { status: Status }) {
  return (
    <span className={status.kind === "error" ? "st-msg err" : "st-msg"} role="status">
      {status.kind === "saving" ? "Saving…" : status.kind === "saved" ? (status.note ?? "Saved.") : status.kind === "error" ? status.msg : ""}
    </span>
  );
}

function Detail({ label, onSave, children }: { label: string; onSave: (fd: FormData) => Promise<SaveResult>; children: React.ReactNode }) {
  const form = useRef<HTMLFormElement>(null);
  const [status, run, reset] = useSave(() => onSave(new FormData(form.current!)));
  return (
    <details className="detail">
      <summary>{label}{status.kind === "saved" && !status.note && <span className="saved"> · Saved</span>}</summary>
      <form ref={form} noValidate onSubmit={(e) => { e.preventDefault(); run(); }} onChange={reset}>
        {children}
        <div className="actions">
          <button className="btn btn-o" type="submit" disabled={status.kind === "saving"}>Save<span className="sr"> {label}</span></button>
          <StatusLine status={status} />
        </div>
      </form>
    </details>
  );
}
