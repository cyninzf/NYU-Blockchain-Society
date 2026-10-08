"use client";

import type { ReactNode } from "react";

/** Event the hero's join flow listens for. Every "Join" CTA dispatches it. */
export const OPEN_JOIN_EVENT = "nbs:open-join";

export function openJoin() {
  window.dispatchEvent(new Event(OPEN_JOIN_EVENT));
}

export default function OpenJoin({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <a
      className={className}
      href="#top"
      onClick={(e) => {
        e.preventDefault();
        openJoin();
      }}
    >
      {children}
    </a>
  );
}
