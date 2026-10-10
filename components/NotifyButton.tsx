"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Me } from "@/app/api/me/route";
import type { Notify } from "@/content/notify";
import OpenJoin from "./OpenJoin";

const PROGRAM: Record<Notify, string> = { networking: "networking events", accelerator: "the accelerator", conference: "the next conference" };

// One request per page load, shared by every button on it.
let me: Promise<Me> | null = null;
const loadMe = () => (me ??= fetch("/api/me", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { member: false })).catch(() => ({ member: false })));

/**
 * A block's "Get notified" (round 14): the join flow with that block's notify interest and
 * ?src= tag. A member signed in on this browser (a live member session) sees "You're on the list"
 * with a link to /update instead; one who hasn't picked this program is pointed there to add it.
 */
export default function NotifyButton({ notify, src, className, children }: { notify: Notify; src: string; className?: string; children: ReactNode }) {
  const [state, setState] = useState<Me | null>(null);
  useEffect(() => { let alive = true; loadMe().then((m) => { if (alive) setState(m); }); return () => { alive = false; }; }, []);
  if (state?.member) {
    return state.notify.includes(notify) ? (
      <p className="on-list" role="status">You&apos;re on the list for {PROGRAM[notify]}. <Link href="/update">Update your block</Link></p>
    ) : (
      <p className="on-list" role="status">You&apos;re a member. <Link href="/update">Add {PROGRAM[notify]} to your updates</Link></p>
    );
  }
  return <OpenJoin className={className} notify={notify} src={src}>{children}</OpenJoin>;
}
