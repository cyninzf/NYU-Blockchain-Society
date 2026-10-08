"use client";

// The pinned story: the 3D blocks stay fixed while the hero (with the join flow), the
// mission and one step per industry scroll past. Ported from docs/prototype.html.
// The join flow is front-end only for now: the member is kept in localStorage.

import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { industries } from "@/content/industries";
import { hero, mission, privacyLine } from "@/content/site";
import { OPEN_JOIN_EVENT } from "../OpenJoin";
import { createField, type Field } from "./field";

const STORAGE_KEY = "nbs-member";
const DONE_TEXT = "That new node is you, connected to your blocks. Want to tell us a bit more? It helps us invite you to the right things.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVOLVEMENT = [
  ["mentor", "Mentor"],
  ["speak", "Speak"],
  ["hire", "Hire"],
  ["invest", "Invest"],
  ["attend", "Attend events"],
] as const;

type Mode = "idle" | "joining" | "done";

const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Story() {
  const [mode, setMode] = useState<Mode>("idle");
  const [sel, setSel] = useState<number[]>([]);
  const [err, setErr] = useState("");
  const [firstName, setFirstName] = useState("");
  const [doneText, setDoneText] = useState(DONE_TEXT);
  const [moreOpen, setMoreOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  const [moreKey, setMoreKey] = useState(0);

  const fieldRef = useRef<Field | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const capTitleRef = useRef<HTMLElement>(null);
  const capTextRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const heroTxtRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<HTMLButtonElement[]>([]);
  const stepRefs = useRef<HTMLDivElement[]>([]);
  const pickRefs = useRef<HTMLButtonElement[]>([]);
  const openJoinRef = useRef<HTMLButtonElement>(null);
  const doneHRef = useRef<HTMLHeadingElement>(null);
  const jfRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const pendingFocus = useRef<"picks" | "done" | "open" | null>(null);

  const toggle = useCallback((i: number) => {
    setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
    setErr("");
  }, []);

  // Canvas field, NY clock and the restored member.
  useEffect(() => {
    const field = createField(
      {
        canvas: canvasRef.current!,
        cap: capRef.current!,
        capTitle: capTitleRef.current!,
        capText: capTextRef.current!,
        heroTxt: heroTxtRef.current!,
        words: wordRefs.current,
        steps: stepRefs.current,
      },
      { onToggle: toggle },
    );
    fieldRef.current = field;

    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const tick = () => { if (clockRef.current) clockRef.current.textContent = fmt.format(new Date()) + " ET"; };
    tick();
    const clock = setInterval(tick, 1000);

    try {
      const m = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (m && Array.isArray(m.blocks) && m.blocks.length) {
        const blocks = (m.blocks as number[]).filter((i) => i >= 0 && i < 3);
        field.addMember(String(m.name || ""), blocks, true);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage after mount
        setSaved(true);
        setSel(blocks);
      }
    } catch {}

    return () => { clearInterval(clock); field.destroy(); fieldRef.current = null; };
  }, [toggle]);

  useEffect(() => { fieldRef.current?.setJoining(mode === "joining"); }, [mode]);
  useEffect(() => { fieldRef.current?.setSelected(sel); }, [sel]);

  // Move focus once the relevant part of the flow has rendered.
  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === "picks") {
      const t = setTimeout(() => pickRefs.current[0]?.focus({ preventScroll: true }), prefersReducedMotion() ? 0 : 350);
      return () => clearTimeout(t);
    }
    if (target === "done") doneHRef.current?.focus({ preventScroll: true });
    if (target === "open") openJoinRef.current?.focus();
  }, [mode]);

  // Every "Join" CTA on the page opens the flow here.
  useEffect(() => {
    const open = () => {
      pendingFocus.current = "picks";
      setMode("joining");
      document.getElementById("top")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
    };
    window.addEventListener(OPEN_JOIN_EVENT, open);
    return () => window.removeEventListener(OPEN_JOIN_EVENT, open);
  }, []);

  const openJoin = () => window.dispatchEvent(new Event(OPEN_JOIN_EVENT));

  const cancel = () => {
    pendingFocus.current = "open";
    setMode("idle");
    setSel([]);
    setErr("");
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = nameRef.current!.value.trim(), email = emailRef.current!.value.trim();
    if (!sel.length) { setErr("Pick at least one block: Blockchain, Finance, or AI."); pickRefs.current[0]?.focus(); return; }
    if (!name) { setErr("Add your name."); nameRef.current!.focus(); return; }
    if (!EMAIL_RE.test(email)) { setErr("Enter an email we can reach you at, like name@example.com."); emailRef.current!.focus(); return; }
    setErr("");
    const blocks = [...sel].sort();
    fieldRef.current?.addMember(name, blocks, false);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, blocks })); } catch {}
    setFirstName(name.split(/\s+/)[0]);
    setDoneText(DONE_TEXT);
    setMoreOpen(true);
    pendingFocus.current = "done";
    setMode("done");
  };

  const finish = (msg: string) => { setMoreOpen(false); setDoneText(msg); };

  const reset = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    fieldRef.current?.clearMember();
    setSel([]);
    jfRef.current?.reset();
    setSaved(false);
    setMoreKey((k) => k + 1);
    pendingFocus.current = "open";
    setMode("idle");
  };

  return (
    <section className="story" id="top" aria-label="Blockchain, finance and AI">
      <div className="pin">
        <canvas
          id="field"
          ref={canvasRef}
          role="img"
          aria-label="The society's logo: three connected blocks for blockchain, finance and AI, floating inside a larger network. Use the words in the headline to highlight each block."
        ></canvas>
        <div className="cap" ref={capRef} aria-live="polite"><b ref={capTitleRef}></b><span ref={capTextRef}></span></div>
        <div className="readout mono" aria-hidden="true">
          <span>New York</span>
          <span ref={clockRef}>--:--:-- ET</span>
          <span className="hint-d">Hover a block · drag to rotate</span>
        </div>
      </div>
      <div className="layer">
        <div className="hero2 wrap">
          <div className="txt" ref={heroTxtRef}>
            <h1>
              {industries.map((ind, i) => (
                <Fragment key={ind.name}>
                  {i > 0 && " "}
                  <button className="w" type="button" ref={(el) => { if (el) wordRefs.current[i] = el; }}>{ind.headlineWord}</button>
                </Fragment>
              ))}
            </h1>
            <p className="lede"><b>{hero.ledeLead}</b> {hero.lede}</p>
            <div className="ctas" hidden={mode !== "idle"}>
              <button className="btn btn-w" type="button" ref={openJoinRef} onClick={openJoin}>
                {saved ? "Edit your block" : "Join the network"}
              </button>
              <a className="btn btn-o" href="#chain">Upcoming events</a>
            </div>
            <form className="jf" ref={jfRef} hidden={mode !== "joining"} noValidate aria-labelledby="jf-legend" onSubmit={submit}>
              <fieldset>
                <legend id="jf-legend">Which blocks do you work in? Pick any, or tap them in the logo.</legend>
                <div className="picks">
                  {industries.map((ind, i) => (
                    <button
                      key={ind.name}
                      className="pick"
                      type="button"
                      aria-pressed={sel.includes(i)}
                      ref={(el) => { if (el) pickRefs.current[i] = el; }}
                      onClick={() => toggle(i)}
                    >
                      {ind.name}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="fields">
                <label>Name<input name="name" ref={nameRef} autoComplete="name" required /></label>
                <label>Email<input name="email" ref={emailRef} type="email" autoComplete="email" inputMode="email" required /></label>
              </div>
              <div className="actions">
                <button className="btn btn-w" type="submit">Add your block</button>
                <button className="link" type="button" onClick={cancel}>Cancel</button>
              </div>
              <p className="err" role="alert">{err}</p>
              <p className="fine">{privacyLine}</p>
            </form>
            <div className="done" hidden={mode !== "done"}>
              <h2 ref={doneHRef} tabIndex={-1}>You&apos;re in the network, <span>{firstName}</span>.</h2>
              <p>{doneText}</p>
              {moreOpen && (
                <form
                  key={moreKey}
                  className="more"
                  noValidate
                  onSubmit={(e) => { e.preventDefault(); finish("Details saved. We'll reach out about events and programs that fit your blocks."); }}
                >
                  <div className="two">
                    <label>Firm<input name="firm" autoComplete="organization" /></label>
                    <label>Role<input name="role" autoComplete="organization-title" /></label>
                  </div>
                  <label>LinkedIn profile URL<input name="linkedin" type="url" inputMode="url" placeholder="linkedin.com/in/..." /></label>
                  <fieldset className="chips">
                    <legend>I&apos;d like to</legend>
                    {INVOLVEMENT.map(([value, label]) => (
                      <label key={value}><input type="checkbox" name="inv" value={value} /><span>{label}</span></label>
                    ))}
                  </fieldset>
                  <div className="actions">
                    <button className="btn btn-w" type="submit">Save details</button>
                    <button className="link" type="button" onClick={() => finish("You can add details anytime from the link in your welcome email.")}>Skip for now</button>
                    <button className="link" type="button" onClick={reset}>Remove my block (preview)</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
        <div className="mission wrap">
          <div className="txt"><p>{mission.text} <span>{mission.muted}</span></p></div>
        </div>
        {industries.map((ind, i) => (
          <div
            key={ind.name}
            className="step wrap"
            id={i === 0 ? "industries" : undefined}
            data-step={i}
            ref={(el) => { if (el) stepRefs.current[i] = el; }}
          >
            <div className="txt">
              <h2>{ind.name}</h2>
              <p>{ind.description}</p>
              <p className="seen"><b>{ind.seenLead}</b> {ind.seen}</p>
            </div>
          </div>
        ))}
        <div className="story-end" aria-hidden="true"></div>
      </div>
    </section>
  );
}
