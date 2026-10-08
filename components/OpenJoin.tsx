"use client";

import type { ReactNode } from "react";
import type { Notify } from "@/content/events";

/** Event the hero's join flow listens for. Every "Join" CTA dispatches it. */
export const OPEN_JOIN_EVENT = "nbs:open-join";
export type OpenJoinDetail = { notify?: Notify };

export function openJoin(detail: OpenJoinDetail = {}) {
  window.dispatchEvent(new CustomEvent<OpenJoinDetail>(OPEN_JOIN_EVENT, { detail }));
}

export default function OpenJoin({ className, notify, children }: { className?: string; notify?: Notify; children: ReactNode }) {
  return (
    <a
      className={className}
      href="#top"
      onClick={(e) => {
        e.preventDefault();
        openJoin({ notify });
      }}
    >
      {children}
    </a>
  );
}
