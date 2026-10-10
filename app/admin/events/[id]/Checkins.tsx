import { desc, eq, ilike, or } from "drizzle-orm";
import type { Admin } from "@/lib/admin";
import { isSuper } from "@/lib/admin";
import type { Db } from "@/lib/db";
import { eventCheckins, members } from "@/lib/db/schema";
import { adminCheckIn, clearTestCheckins } from "../actions";
import styles from "../../admin.module.css";

const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
const METHOD = { qr: "QR / link", admin: "By an admin" } as const;

/**
 * Who checked in: count and list for both roles; manual check-in and the CSV export for super
 * admins. Test check-ins (test mode) are listed apart, never counted, and can be cleared.
 */
export default async function Checkins({ db, eventId, admin, q, showReal }: { db: Db; eventId: number; admin: Admin; q: string; showReal: boolean }) {
  const all = await db.select({ id: members.id, name: members.name, at: eventCheckins.checkedInAt, method: eventCheckins.method, test: eventCheckins.isTest })
    .from(eventCheckins).innerJoin(members, eq(members.id, eventCheckins.memberId))
    .where(eq(eventCheckins.eventId, eventId)).orderBy(desc(eventCheckins.checkedInAt));
  const rows = all.filter((r) => !r.test), tests = all.filter((r) => r.test);
  if (!showReal) return <TestCheckins tests={tests} eventId={eventId} admin={admin} />;
  const inIds = new Set(rows.map((r) => r.id));
  const like = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : "";
  const found = isSuper(admin) && q
    ? await db.select({ id: members.id, name: members.name, email: members.email }).from(members)
      .where(or(ilike(members.name, like), ilike(members.email, like), ...(/^#?\d+$/.test(q) ? [eq(members.id, Number(q.replace("#", "")))] : [])))
      .orderBy(members.id).limit(10)
    : [];
  return (
    <section className={styles.mix} aria-labelledby="ci-h">
      <h2 id="ci-h">Check-ins ({rows.length})</h2>
      {isSuper(admin) && (
        <div className={styles.row}>
          <form method="get" className={styles.filters}>
            <label>Check in a member<input name="q" type="search" defaultValue={q} placeholder="Name, email or block number" /></label>
            <button type="submit">Search</button>
          </form>
          {rows.length > 0 && <a className={styles.export} href={`/admin/events/${eventId}/checkins/export`}>Export CSV ({rows.length})</a>}
        </div>
      )}
      {found.length > 0 && (
        <ul className={styles.edit}>
          {found.map((m) => (
            <li key={m.id} className={styles.row}>
              <span>#{m.id} · {m.name} · {m.email}</span>
              {inIds.has(m.id) ? <span className={styles.badge}>Checked in</span> : (
                <form action={adminCheckIn}>
                  <input type="hidden" name="id" value={eventId} />
                  <input type="hidden" name="memberId" value={m.id} />
                  <button type="submit">Check in</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {isSuper(admin) && q && !found.length && <p className={styles.note}>No member matches &ldquo;{q}&rdquo;.</p>}
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Name</th><th scope="col">Block</th><th scope="col">Checked in (ET)</th><th scope="col">How</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}><td>{r.name}</td><td>#{r.id}</td><td>{timeFmt.format(r.at)}</td><td>{METHOD[r.method]}</td></tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className={styles.empty}>No one has checked in yet.</p>}
      </div>
      <TestCheckins tests={tests} eventId={eventId} admin={admin} />
    </section>
  );
}

function TestCheckins({ tests, eventId, admin }: { tests: { id: number; name: string; at: Date; method: "qr" | "admin" }[]; eventId: number; admin: Admin }) {
  if (!tests.length) return null;
  return (
    <div className={styles.mix}>
      <h3>Test check-ins ({tests.length}) <span className={styles.note}>From test mode: never counted, never on the real live screen.</span></h3>
      <ul className={styles.edit}>
        {tests.map((r) => <li key={r.id}>{r.name} · #{r.id} · {timeFmt.format(r.at)} · {METHOD[r.method]}</li>)}
      </ul>
      {isSuper(admin) && (
        <form action={clearTestCheckins}>
          <input type="hidden" name="id" value={eventId} />
          <button type="submit">Clear test check-ins</button>
        </form>
      )}
    </div>
  );
}
