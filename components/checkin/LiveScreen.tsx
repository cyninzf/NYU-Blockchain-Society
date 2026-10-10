"use client";

import { useEffect, useRef, useState } from "react";
import { backdropArrive } from "../backdrop/backdrop";

const POLL_MS = 4000;

/**
 * The live screen's overlay: polls the check-in count and adds one node to the background
 * network per new check-in. Shows the event title small at the bottom; the count only with ?count=1.
 */
/** `displayToken`: opened through a display link (no sign-in); it's sent with each poll. */
export default function LiveScreen({ slug, title, showCount, displayToken, test = false }: { slug: string; title: string; showCount: boolean; displayToken?: string; test?: boolean }) {
  const [n, setN] = useState<number | null>(null);
  const [lost, setLost] = useState(false);
  const last = useRef<number | null>(null);

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
        // The first answer is the baseline; every increase after it arrives as new nodes.
        if (last.current !== null && count > last.current) {
          for (let k = 0; k < Math.min(count - last.current, 12); k++) timers.push(window.setTimeout(backdropArrive, k * 450));
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
      {showCount && n !== null && <p className="live-count" data-bg="solid">{n} checked in tonight</p>}
      {lost && <p className="live-lost mono" role="status">Reconnecting…</p>}
      <button type="button" className="live-fs mono" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>Full screen</button>
    </div>
  );
}
