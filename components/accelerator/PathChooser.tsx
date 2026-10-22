"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import Icon from "../Icon";

type Path = { id: string; title: string; text: string; cta: string };

// The open path lives in the URL hash (#founder / #investor, links in sent emails keep working).
// Switching replaces the hash in place: no history entry, no jump; ?src= stays in the URL.
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  addEventListener("hashchange", cb);
  return () => { listeners.delete(cb); removeEventListener("hashchange", cb); };
};
const readHash = () => decodeURIComponent(location.hash.slice(1));
const writeHash = (id: string | null) => {
  window.history.replaceState(window.history.state, "", `${location.pathname}${location.search}${id ? `#${id}` : ""}`);
  listeners.forEach((l) => l());
};
const noSubscribe = () => () => {};

/**
 * /accelerator's two paths as a chooser (round 30): each card is a button (aria-expanded,
 * aria-controls) that opens its form right below the cards and closes the other; clicking the open
 * one closes it. Nothing is open on load unless the hash names a path, which opens it and scrolls
 * to it. Progressive enhancement: the server (and a browser without JavaScript) renders the cards
 * as links to #founder / #investor with both forms shown; the chooser takes over once hydrated.
 * Forms stay mounted while hidden, so switching back keeps what was typed. Each form's own heading
 * and intro (`heads`) show only without the chooser; with it, the selected card above says the same,
 * so the form's section is named by that card's title instead.
 */
export default function PathChooser({ paths, heads, forms, after }: { paths: readonly Path[]; heads: Record<string, ReactNode>; forms: Record<string, ReactNode>; after: ReactNode }) {
  const enhanced = useSyncExternalStore(noSubscribe, () => true, () => false);
  const hash = useSyncExternalStore(subscribe, readHash, () => "");
  const open = paths.some((p) => p.id === hash) ? hash : null;

  // Arrived with #founder / #investor: the layout changed once the other form was hidden, so
  // bring the open form back into view, once.
  const arrived = useRef(false);
  useEffect(() => {
    if (!enhanced || arrived.current) return;
    arrived.current = true;
    if (open) document.getElementById(open)?.scrollIntoView({ block: "start" });
  }, [enhanced, open]);

  return (
    <>
      <ol className="acc-paths" aria-label="Two ways in">
        {paths.map((p, i) => {
          const on = enhanced && open === p.id;
          return (
            <li className={on ? "ed-blk on" : "ed-blk next"} key={p.id} data-bg="dim">
              <div className="top mono"><span>Path {String(i + 1).padStart(2, "0")}</span></div>
              <h2 id={`${p.id}-path`}>{p.title}</h2>
              <p>{p.text}</p>
              {enhanced
                ? <button className="blk-go go" type="button" aria-expanded={on} aria-controls={p.id} onClick={() => writeHash(on ? null : p.id)}>{p.cta} <Icon name="arrow-down" /></button>
                : <a className="blk-go go" href={`#${p.id}`}>{p.cta} <Icon name="arrow-down" /></a>}
            </li>
          );
        })}
      </ol>
      {paths.map((p) => (
        <section className="iq acc-form" id={p.id} key={p.id} hidden={enhanced && open !== p.id} aria-labelledby={enhanced ? `${p.id}-path` : `${p.id}-form`}>
          {!enhanced && heads[p.id]}
          {forms[p.id]}
        </section>
      ))}
      {after}
    </>
  );
}
