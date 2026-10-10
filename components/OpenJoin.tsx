"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Notify } from "@/content/notify";

/** Event the hero's join flow listens for. Every "Join" CTA dispatches it. */
export const OPEN_JOIN_EVENT = "nbs:open-join";
export type OpenJoinDetail = { notify?: Notify };

export function openJoin(detail: OpenJoinDetail = {}) {
  window.dispatchEvent(new CustomEvent<OpenJoinDetail>(OPEN_JOIN_EVENT, { detail }));
}

/** URL that opens the join flow from any page: the home page reads ?join and cleans it up. */
export const joinHref = (notify?: Notify) => `/?join=1${notify ? `&notify=${notify}` : ""}`;

export default function OpenJoin({ className, notify, children }: { className?: string; notify?: Notify; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <a
      className={className}
      href={joinHref(notify)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        if (pathname === "/") openJoin({ notify });
        else router.push(joinHref(notify));
      }}
    >
      {children}
    </a>
  );
}
