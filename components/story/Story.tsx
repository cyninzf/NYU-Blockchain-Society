"use client";

// The pinned story: the 3D blocks stay fixed while the hero (with the join flow), the
// mission and one step per industry scroll past. Ported from docs/prototype.html.

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { NOTIFY, type Notify } from "@/content/events";
import { industries } from "@/content/industries";
import { affiliation, hero, mission } from "@/content/site";
import { OPEN_JOIN_EVENT, openJoin, type OpenJoinDetail } from "../OpenJoin";
import { createField, type Field } from "./field";
import JoinFlow from "./JoinFlow";

type Mode = "idle" | "joining" | "done";

const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Story() {
  const [mode, setMode] = useState<Mode>("idle");
  const [sel, setSel] = useState<number[]>([]);
  const [notify, setNotify] = useState<Notify | undefined>();
  const [flowKey, setFlowKey] = useState(0);

  const fieldRef = useRef<Field | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const capTitleRef = useRef<HTMLElement>(null);
  const capTextRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const heroTxtRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<HTMLButtonElement[]>([]);
  const stepRefs = useRef<HTMLDivElement[]>([]);
  const openJoinRef = useRef<HTMLButtonElement>(null);
  const focusOpenButton = useRef(false);

  const toggle = useCallback((i: number) => {
    setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  }, []);

  // Canvas field, NY clock and the hero HUD.
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

    // The HUD belongs to the hero only: fade it out over the first half-screen of scroll.
    const hud = hudRef.current!;
    const fadeHud = () => {
      const o = Math.max(0, 1 - window.scrollY / (window.innerHeight * 0.5));
      hud.style.opacity = String(o);
      hud.style.visibility = o > 0 ? "visible" : "hidden";
    };
    fadeHud();
    window.addEventListener("scroll", fadeHud, { passive: true });
    window.addEventListener("resize", fadeHud);

    return () => { clearInterval(clock); window.removeEventListener("scroll", fadeHud); window.removeEventListener("resize", fadeHud); field.destroy(); fieldRef.current = null; };
  }, [toggle]);

  useEffect(() => { fieldRef.current?.setJoining(mode === "joining"); }, [mode]);
  useEffect(() => { fieldRef.current?.setSelected(sel); }, [sel]);
  useEffect(() => {
    if (mode === "idle" && focusOpenButton.current) { focusOpenButton.current = false; openJoinRef.current?.focus(); }
  }, [mode]);

  // Every "Join" CTA on the page opens the flow here, optionally with a program to hear about.
  useEffect(() => {
    const open = (e: Event) => {
      setNotify((e as CustomEvent<OpenJoinDetail>).detail?.notify);
      setFlowKey((k) => k + 1);
      setMode("joining");
      document.getElementById("top")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
    };
    window.addEventListener(OPEN_JOIN_EVENT, open);
    // Arrived from a Join link on another page (/?join=1&notify=...): open the flow, then tidy the URL.
    const params = new URLSearchParams(window.location.search);
    if (params.get("join")) {
      const n = params.get("notify");
      openJoin({ notify: NOTIFY.includes(n as Notify) ? (n as Notify) : undefined });
      params.delete("join"); params.delete("notify");
      const q = params.toString();
      window.history.replaceState(window.history.state, "", `/${q ? `?${q}` : ""}#top`);
    }
    return () => window.removeEventListener(OPEN_JOIN_EVENT, open);
  }, []);

  const onProgress = useCallback((steps: number) => fieldRef.current?.setProgress(steps, sel), [sel]);
  const onJoined = useCallback((name: string) => {
    fieldRef.current?.addMember(name, [...sel].sort(), false);
    setMode("done");
  }, [sel]);
  const close = useCallback(() => {
    fieldRef.current?.setProgress(0, []);
    if (mode === "joining") setSel([]);
    focusOpenButton.current = true;
    setMode("idle");
  }, [mode]);

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
        <div className="readout mono" ref={hudRef} aria-hidden="true">
          <span>New York</span>
          <span ref={clockRef}>--:--:-- ET</span>
          <span className="hint-d">Hover a block · drag to rotate</span>
        </div>
      </div>
      <div className="layer">
        <div className={mode === "idle" ? "hero2 wrap" : "hero2 wrap flow"}>
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
            <p className="affil">
              <a href={affiliation.href} target="_blank" rel="noopener">
                {affiliation.label} <span aria-hidden="true">↗</span><span className="sr"> (opens in a new tab)</span>
              </a>
            </p>
            <div className="ctas" hidden={mode !== "idle"}>
              <button className="btn btn-w" type="button" ref={openJoinRef} onClick={() => openJoin()}>Join the network</button>
            </div>
            {mode !== "idle" && (
              <JoinFlow key={flowKey} sel={sel} toggle={toggle} notify={notify} onProgress={onProgress} onJoined={onJoined} onClose={close} />
            )}
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
