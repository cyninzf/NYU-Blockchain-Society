import { firms } from "@/content/firms";
import { conference, formatPerson, program } from "@/content/program";

export default function Conference() {
  return (
    <section className="conf" id="conference" aria-labelledby="conf-h">
      <div className="wrap conf-grid">
        <div>
          <h2 id="conf-h">NYU Blockchain Conference {conference.year}</h2>
          <p className="when mono">{conference.date} · {conference.address}</p>
          <p className="figs">
            <b>{conference.registrations}</b> registrations. <b>{conference.speakers}</b> speakers and moderators.{" "}
            <b>{conference.panels}</b> panels plus a fireside in one day.
          </p>
          <h3 className="firms-h mono">Speakers came from</h3>
          <div className="firms">
            {firms.map((f) => <span key={f}>{f}</span>)}
          </div>
        </div>
        <ol className="prog" aria-label="Program">
          {program.map((s) => (
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
      </div>
    </section>
  );
}
