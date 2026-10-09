import CopyButton from "@/components/CopyButton";
import { boilerplate, wordCount } from "@/content/boilerplate";
import b from "./boilerplate.module.css";

/**
 * Ready-to-paste descriptions. Public on /media-kit only once `boilerplateStatus` is "approved";
 * until then admins review it at /admin/media-kit-preview, the only place the Draft tag shows.
 */
export default function Boilerplate({ className, draft = false }: { className?: string; draft?: boolean }) {
  return (
    <section className={className} data-bg="dim" aria-labelledby="mk-boiler">
      <h2 id="mk-boiler" className={b.h2}>
        Boilerplate {draft && <span className={`${b.draft} mono`}>Draft, pending review</span>}
      </h2>
      <ul className={b.boiler}>
        {boilerplate.map((x) => (
          <li key={x.id}>
            <div className={b.bhead}>
              <h3>{x.label} <span className="mono">{wordCount(x.text)} words</span></h3>
              <CopyButton className="btn btn-o" text={x.text} label={`Copy the ${x.label.toLowerCase()} description`} />
            </div>
            <p>{x.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
