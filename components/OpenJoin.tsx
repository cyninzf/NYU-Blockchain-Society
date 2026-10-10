"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Notify } from "@/content/notify";
import { setJoinSource } from "@/lib/join-source";

/** Event the hero's join flow listens for. Every "Join" CTA dispatches it. */
export const OPEN_JOIN_EVENT = "nbs:open-join";
export type OpenJoinDetail = { notify?: Notify };

export function openJoin(detail: OpenJoinDetail = {}) {
  window.dispatchEvent(new CustomEvent<OpenJoinDetail>(OPEN_JOIN_EVENT, { detail }));
}

/** URL that opens the join flow from any page: the home page reads ?join and cleans it up (?src stays for the join). */
export const joinHref = (notify?: Notify, src?: string) => `/?join=1${notify ? `&notify=${notify}` : ""}${src ? `&src=${encodeURIComponent(src)}` : ""}`;

/** `src`: the join source this link carries (e.g. event-<slug>), stored on the member when they join. */
/** `onOpen`: called on every click (analytics), before the flow opens or the page changes. */
export default function OpenJoin({ className, notify, src, onOpen, children }: { className?: string; notify?: Notify; src?: string; onOpen?: () => void; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <a
      className={className}
      href={joinHref(notify, src)}
      onClick={(e) => {
        onOpen?.();
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        if (src) setJoinSource(src);
        if (pathname === "/") openJoin({ notify });
        else router.push(joinHref(notify, src));
      }}
    >
      {children}
    </a>
  );
}
