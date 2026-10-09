import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { linkedinGroupMembers as roster, members } from "@/lib/db/schema";
import { fieldBuckets, nameScore } from "@/lib/linkedin-import";
import { listRoster, parseRosterFilters, rosterCounts } from "@/lib/roster-query";
import { deleteRosterRow, linkRosterMember, unlinkRosterMember } from "./actions";
import styles from "../admin.module.css";

export const metadata: Metadata = {
  title: "LinkedIn group · Admin",
  robots: { index: false, follow: false },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function RosterPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <h1>LinkedIn group</h1>
      <p className={styles.lede}>The group roster from LinkedIn&apos;s member export: name, headline and group role only. People on it aren&apos;t members until they join; link a row to a member by hand when you&apos;re sure it&apos;s the same person.</p>
      <Suspense fallback={<p>Loading…</p>}>
        <Roster searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" });
const ROLE = { owner: "Owner", manager: "Manager" } as const;
const SHOWN = 200;

async function Roster({ searchParams }: { searchParams: SP }) {
  const f = parseRosterFilters(await searchParams);
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const [rows, counts, people, headlines] = await Promise.all([
    listRoster(db, f),
    rosterCounts(db),
    db.select({ id: members.id, name: members.name }).from(members),
    db.select({ h: roster.headline, m: roster.memberId }).from(roster),
  ]);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  const mix = fieldBuckets(headlines.map((x) => x.h));
  const linked = new Set(headlines.map((x) => x.m).filter(Boolean));
  // Likely matches by name, for the admin to confirm. Never linked automatically.
  const suggest = (name: string) => people
    .filter((m) => !linked.has(m.id))
    .map((m) => ({ ...m, score: nameScore(name, m.name) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, 3);

  return (
    <>
      <dl className={styles.counts}>
        <div><dt>On the roster</dt><dd>{counts.roster}</dd></div>
        <div><dt>Linked to members</dt><dd>{counts.linked}</dd></div>
        <div><dt>Not yet joined</dt><dd>{counts.notJoined}</dd></div>
        <div><dt>Joined via ?src=linkedin-group</dt><dd>{counts.viaLink}</dd></div>
      </dl>

      <section className={styles.mix} aria-labelledby="mix-h">
        <h2 id="mix-h">Field mix <span>Rough keyword buckets from headlines, counts only. A headline can count in more than one.</span></h2>
        <dl className={styles.counts}>
          {mix.map((b) => <div key={b.id}><dt>{b.label}</dt><dd>{b.n}</dd></div>)}
        </dl>
      </section>

      <form className={styles.filters} method="get">
        <label>Search
          <input name="q" type="search" defaultValue={f.q ?? ""} placeholder="Name or headline" />
        </label>
        <label>Group role
          <select name="role" defaultValue={f.role ?? ""}>
            <option value="">Any</option>
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="member">Member</option>
          </select>
        </label>
        <label>Joined
          <select name="joined" defaultValue={f.joined ?? ""}>
            <option value="">Any</option>
            <option value="yes">Linked to a member</option>
            <option value="no">Not yet joined</option>
          </select>
        </label>
        <button type="submit">Filter</button>
        <a href="/admin/linkedin">Clear</a>
        <Link href="/admin/linkedin/import">Import a newer export</Link>
        <a className={styles.export} href={`/admin/linkedin/export${qs ? `?${qs}` : ""}`}>Export CSV ({rows.length})</a>
      </form>

      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="sr">LinkedIn group roster, newest first</caption>
          <thead>
            <tr>
              <th scope="col">ID</th><th scope="col">Name</th><th scope="col">Headline</th><th scope="col">Group role</th>
              <th scope="col">Source</th><th scope="col">Imported</th><th scope="col">Member</th><th scope="col"><span className="sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, SHOWN).map(({ r, memberName }) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.name}</td>
                <td>{r.headline}</td>
                <td>{r.groupRole ? ROLE[r.groupRole] : "Member"}</td>
                <td>{r.source}</td>
                <td>{dateFmt.format(r.importedAt)}</td>
                <td>
                  {r.memberId ? (
                    <form action={unlinkRosterMember}>
                      <input type="hidden" name="id" value={r.id} />
                      <div>Block #{r.memberId}{memberName ? ` · ${memberName}` : ""}</div>
                      <button type="submit">Unlink</button>
                    </form>
                  ) : (
                    <details className={styles.editd}>
                      <summary>Link to member</summary>
                      <div className={styles.edit}>
                        {suggest(r.name).map((m) => (
                          <form key={m.id} action={linkRosterMember}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="memberId" value={m.id} />
                            <button type="submit">Link #{m.id} · {m.name}</button>
                          </form>
                        ))}
                        <form action={linkRosterMember} className={styles.row}>
                          <input type="hidden" name="id" value={r.id} />
                          <label>Block number<input name="memberId" inputMode="numeric" pattern="#?[0-9]*" required /></label>
                          <button type="submit">Link</button>
                        </form>
                      </div>
                    </details>
                  )}
                </td>
                <td>
                  <details className={styles.del}>
                    <summary>Delete</summary>
                    <form action={deleteRosterRow}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="confirm" value="yes" />
                      <button type="submit">Delete row {r.id} permanently</button>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className={styles.empty}>{counts.roster ? "No one on the roster matches these filters." : <>The roster is empty. <Link href="/admin/linkedin/import">Import the group export</Link>.</>}</p>}
        {rows.length > SHOWN && <p className={styles.empty}>Showing the first {SHOWN} of {rows.length}. Search or filter to narrow it down; the CSV export has all of them.</p>}
      </div>
    </>
  );
}
