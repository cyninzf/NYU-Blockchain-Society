import { events, type EventStatus } from "@/content/events";
import { chainIntro } from "@/content/site";

const STATUS: Record<EventStatus, { label: string; dot: string; block: string }> = {
  confirmed: { label: "Confirmed", dot: "st ok", block: "blk" },
  pending: { label: "Pending", dot: "st pend", block: "blk live" },
  building: { label: "Building", dot: "st", block: "blk dim" },
};

export default function Chain() {
  return (
    <section className="chain" id="chain" aria-labelledby="chain-h">
      <div className="wrap">
        <div className="chain-head">
          <h2 id="chain-h">The chain so far</h2>
          <p>{chainIntro}</p>
        </div>
        <ol className="blocks">
          {events.map((ev) => {
            const st = STATUS[ev.status];
            return (
              <li className={st.block} key={ev.label}>
                <div className="top mono">
                  <span>{ev.label}</span>
                  <span className={st.dot}><i></i>{st.label}</span>
                </div>
                <h3>{ev.title}</h3>
                <p>{ev.text}</p>
                {ev.stats && (
                  <div className="foot mono">
                    {ev.stats.map((s) => (
                      <span key={s.label}><b>{s.value}</b> {s.label}</span>
                    ))}
                  </div>
                )}
                {ev.cta && (
                  <a className="btn btn-w" href={ev.cta.href} target="_blank" rel="noopener">
                    {ev.cta.label}
                  </a>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
