import { editionTitle, type Edition } from "@/content/conferences";
import { formatPerson } from "@/content/program";
import Icon from "../Icon";

/** A full conference edition: heading, date and venue, stats, speaker firms, expandable program. */
export default function EditionDetail({ edition: e }: { edition: Edition }) {
  return (
    <div className="wrap conf-grid">
      <div data-bg="dim">
        <h1 id="conf-h">{editionTitle(e)}</h1>
        {(e.date || e.address) && <p className="when mono">{[e.date, e.address].filter(Boolean).join(" · ")}</p>}
        {e.stats && (
          <p className="figs">
            <b>{e.stats.registrations}</b> registrations. <b>{e.stats.speakers}</b> speakers and moderators.{" "}
            <b>{e.stats.panels}</b> panels{e.stats.fireside ? " plus a fireside" : ""} in one day.
          </p>
        )}
        {e.firms && (
          <>
            <h2 className="firms-h mono">Speakers came from</h2>
            <div className="firms">
              {e.firms.map((f) => <span key={f}>{f}</span>)}
            </div>
          </>
        )}
        {e.lumaUrl && e.status === "announced" && (
          <p><a className="btn btn-w" href={e.lumaUrl} target="_blank" rel="noopener">Register on Luma <Icon name="arrow-up-right" /><span className="sr"> (opens in a new tab)</span></a></p>
        )}
      </div>
      {e.program && (
        <ol className="prog" aria-label="Program" data-bg="dim">
          {e.program.map((s) => (
            <li key={s.time}>
              <details>
                <summary>
                  <time className="mono">{s.time}</time>
                  <span className="t">{s.title}</span>
                  <span className="w">{s.who}</span>
                  <span className="chev" aria-hidden="true"></span>
                </summary>
                <div className="ppl">
                  {s.moderator && (
                    <p><span className="role mono">Moderator</span>{formatPerson(s.moderator)}</p>
                  )}
                  <p className="role mono">{s.moderator ? "Speakers" : "Speaker"}</p>
                  <ul>
                    {s.speakers.map((p) => <li key={formatPerson(p)}>{formatPerson(p)}</li>)}
                  </ul>
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
