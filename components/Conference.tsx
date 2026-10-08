import { firms } from "@/content/firms";
import { conference, program } from "@/content/program";

export default function Conference() {
  return (
    <section className="conf" id="conference" aria-labelledby="conf-h">
      <div className="wrap conf-grid">
        <div>
          <h2 id="conf-h">The NYU Blockchain Conference</h2>
          <p className="figs">
            <b>{conference.registrations}</b> registrations. <b>{conference.speakers}</b> speakers and moderators.{" "}
            <b>{conference.panels}</b> panels in one day, {conference.year}.
          </p>
          <div className="firms" aria-label="Speakers came from">
            {firms.map((f) => <span key={f}>{f}</span>)}
          </div>
        </div>
        <ol className="prog">
          {program.map((s) => (
            <li key={s.time}>
              <time className="mono">{s.time}</time>
              <span className="t">{s.title}</span>
              <span className="w">{s.who}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
