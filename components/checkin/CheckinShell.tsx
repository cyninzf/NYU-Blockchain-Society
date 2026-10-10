import Image from "next/image";
import Link from "next/link";
import { eventWhen } from "@/lib/event-time";

/** The check-in card: brand, the event and its time, then the step. */
export default function CheckinShell({ e, children }: { e: { title: string; kind: string | null; slug: string; startsAt: Date; endsAt: Date | null; venueName: string | null }; children: React.ReactNode }) {
  return (
    <section className="ci" aria-labelledby="ci-h">
      <Link className="ci-brand" href="/"><Image src="/brand/mark-node-white.svg" width={32} height={32} alt="" />NYU Blockchain Society</Link>
      <div className="ci-card" data-bg="solid">
        <p className="kicker mono">Check-in · {e.kind || "Event"}</p>
        <h1 id="ci-h">{e.title}</h1>
        <p className="ci-when mono">{eventWhen(e.startsAt, e.endsAt)}{e.venueName && <> · {e.venueName}</>}</p>
        {children}
      </div>
    </section>
  );
}
