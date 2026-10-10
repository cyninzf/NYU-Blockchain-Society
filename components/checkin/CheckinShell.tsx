import Image from "next/image";
import Link from "next/link";
import { eventWhen } from "@/lib/event-time";

/** The check-in card: brand, the event and its time, then the step. `test`: the test-mode banner (round 12.1). */
export default function CheckinShell({ e, test = false, children }: { e: { title: string; kind: string | null; slug: string; startsAt: Date; endsAt: Date | null; venueName: string | null }; test?: boolean; children: React.ReactNode }) {
  return (
    <section className="ci" aria-labelledby="ci-h">
      <Link className="ci-brand" href="/"><Image src="/brand/mark-node-white.svg" width={32} height={32} alt="" />NYU Blockchain Society</Link>
      <div className="ci-card" data-bg="solid">
        {test && <TestBanner />}
        <p className="kicker mono">Check-in · {e.kind || "Event"}</p>
        <h1 id="ci-h">{e.title}</h1>
        <p className="ci-when mono">{eventWhen(e.startsAt, e.endsAt)}{e.venueName && <> · {e.venueName}</>}</p>
        {children}
      </div>
    </section>
  );
}

/** Shown on every test-mode screen. */
export function TestBanner() {
  return <p className="ci-test mono" role="note">Test mode · check-ins are stored as tests and never counted</p>;
}
