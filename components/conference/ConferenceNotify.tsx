"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { nextEditionSource } from "@/content/conferences";
import { loadMarker } from "@/lib/you-marker";
import Icon from "../Icon";
import OpenJoin from "../OpenJoin";

/**
 * "Get notified": the join flow with conference updates picked and ?src=conference-<year>. Someone
 * who already joined in this browser (the local "You" marker) also sees that they'll hear if they
 * chose conference updates, and where to change that. Re-joining with the same email just adds it.
 */
const noop = () => () => {};

export default function ConferenceNotify() {
  // Browser-only (localStorage): false on the server and in the first render, then the real value.
  const member = useSyncExternalStore(noop, () => Boolean(loadMarker()), () => false);
  return (
    <div className="conf-notify">
      <OpenJoin className="btn btn-w" notify="conference" src={nextEditionSource}>Get notified <Icon name="arrow-right" /></OpenJoin>
      {member && (
        <p className="conf-member">You&apos;re already on the chain. If you chose conference updates, we&apos;ll tell you when it&apos;s announced. <Link href="/update">Change your updates</Link></p>
      )}
    </div>
  );
}
