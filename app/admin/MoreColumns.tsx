"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import styles from "./admin.module.css";

// "More columns" (round 28.2): the table's extra columns (cells with styles.more) stay hidden until
// this is switched on. Remembered per browser (localStorage, never sent anywhere); default off,
// and not remembered when storage is blocked. The server render is always off, so hydration matches.

const EVENT = "nyubs:more-columns";
// Fallback when storage is blocked: still toggles, just isn't remembered.
const memory = new Map<string, boolean>();
const read = (key: string) => { try { return localStorage.getItem(key) === "1"; } catch { return memory.get(key) ?? false; } };
const subscribe = (fn: () => void) => {
  window.addEventListener("storage", fn);
  window.addEventListener(EVENT, fn);
  return () => { window.removeEventListener("storage", fn); window.removeEventListener(EVENT, fn); };
};

export default function MoreColumns({ storageKey, label = "More columns", children }: { storageKey: string; label?: string; children: ReactNode }) {
  const on = useSyncExternalStore(subscribe, () => read(storageKey), () => false);
  const toggle = (v: boolean) => {
    memory.set(storageKey, v);
    try { if (v) localStorage.setItem(storageKey, "1"); else localStorage.removeItem(storageKey); } catch { /* not remembered */ }
    window.dispatchEvent(new Event(EVENT));
  };
  return (
    <div className={on ? undefined : styles.moreOff}>
      <label className={styles.moreToggle}><input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} /> {label}</label>
      {children}
    </div>
  );
}
