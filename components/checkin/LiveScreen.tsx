"use client";

import { useEffect, useRef, useState } from "react";
import { backdropArrive, setBackdropLiveMode } from "../backdrop/backdrop";

const POLL_MS = 4000;
/** Arrivals in one poll are spaced out (about the length of the hold) so each gets its own moment. */
const STAGGER_MS = 3000;
/** Check-ins already there when the screen opens appear at once (no arrival), up to this many. */
const MAX_QUIET = 150;

/**
 * The live screen's overlay: polls the check-in count and adds one node to the background
 * network per new check-in. Shows the event title small at the bottom; the count only with ?count=1.
 */
/** `displayToken`: opened through a display link (no sign-in); it's sent with each poll. */
export default function LiveScreen({ slug, title, showCount, displayToken, test = false }: { slug: string; title: string; showCount: boolean; displayToken?: string; test?: boolean }) {
  const [n, setN] = useState<number | null>(null);
  const [lost, setLost] = useState(false);
  const last = useRef<number | null>(null);

  // The ambient network dims while this screen is open, so check-ins stand out.
  useEffect(() => { setBackdropLiveMode(true); return () => setBackdropLiveMode(false); }, []);

  useEffect(() => {
    let alive = true, timer = 0;
    const timers: number[] = [];
    const poll = async () => {
      try {
        const q = test ? "?test=1" : displayToken ? `?d=${encodeURIComponent(displayToken)}` : "";
        const r = await fetch(`/api/events/${slug}/checkins${q}`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const { count } = (await r.json()) as { count: number };
        if (!alive) return;
        // The first answer: the evening so far, placed at once. Every increase after it arrives
        // as new nodes, each with its own moment.
        if (last.current === null) for (let k = 0; k < Math.min(count, MAX_QUIET); k++) backdropArrive(true);
        else if (count > last.current) {
          for (let k = 0; k < Math.min(count - last.current, 12); k++) timers.push(window.setTimeout(() => backdropArrive(), k * STAGGER_MS));
        }
        last.current = count;
        setN(count); setLost(false);
      } catch {
        if (alive) setLost(true);
      }
      if (alive) timer = window.setTimeout(poll, POLL_MS);
    };
    poll();
    return () => { alive = false; clearTimeout(timer); timers.forEach(clearTimeout); };
  }, [slug, displayToken, test]);

  return (
    <div className="live">
      <p className="live-title mono" data-bg="solid">{title}</p>
      {test && <p className="live-test mono" data-bg="solid">Test mode · showing test check-ins only</p>}
      {showCount && n !== null && (
        <p className="live-count" data-bg="solid" aria-live="polite">
          {/* keyed by the number, so each change replays the tick animation */}
          <span key={n} className="live-n">{n}</span> checked in tonight
        </p>
      )}
      {lost && <p className="live-lost mono" role="status">Reconnecting…</p>}
      <button type="button" className="live-fs mono" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>Full screen</button>
    </div>
  );
}
