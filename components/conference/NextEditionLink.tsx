import { nextEdition } from "@/content/conferences";
import OpenJoin from "../OpenJoin";

/** The next edition: Luma once it's announced with a link, otherwise "get notified" via the join flow. */
export default function NextEditionLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const e = nextEdition;
  if (e?.status === "announced" && e.lumaUrl) {
    return (
      <a className={className} href={e.lumaUrl} target="_blank" rel="noopener">
        {children}<span className="sr"> (register on Luma, opens in a new tab)</span>
      </a>
    );
  }
  return <OpenJoin className={className} notify="conference">{children}<span className="sr"> (get notified when it&apos;s announced)</span></OpenJoin>;
}
