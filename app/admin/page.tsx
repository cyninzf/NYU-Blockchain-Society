import type { Metadata } from "next";
import { Suspense } from "react";
import { NOTIFY } from "@/content/events";
import { industries } from "@/content/industries";
import { getDb } from "@/lib/db";
import { AFFILIATIONS } from "@/lib/db/schema";
import { AFFILIATION_LABELS, listMembers, parseFilters } from "@/lib/members-query";
import { deleteMember, setWallApproved } from "./actions";
import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: "Members · Admin",
  robots: { index: false, follow: false },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function AdminPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <h1>Members</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Members searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" });

async function Members({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const rows = await listMembers(db, f);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <form className={styles.filters} method="get">
        <label>Affiliation
          <select name="affiliation" defaultValue={f.affiliation ?? ""}>
            <option value="">Any</option>
            {AFFILIATIONS.map((a) => <option key={a} value={a}>{AFFILIATION_LABELS[a]}</option>)}
          </select>
        </label>
        <label>Block
          <select name="block" defaultValue={f.block ?? ""}>
            <option value="">Any</option>
            {industries.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
        <label>Notify
          <select name="notify" defaultValue={f.notify ?? ""}>
            <option value="">Any</option>
            {NOTIFY.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>Wall
          <select name="wall" defaultValue={f.wall ?? ""}>
            <option value="">Any</option>
            <option value="pending">Waiting for approval</option>
            <option value="approved">Approved</option>
          </select>
        </label>
        <button type="submit">Filter</button>
        <a href="/admin">Clear</a>
        <a className={styles.export} href={`/admin/export${qs ? `?${qs}` : ""}`}>Export CSV ({rows.length})</a>
      </form>

      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="sr">Members, newest first</caption>
          <thead>
            <tr>
              <th scope="col">#</th><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Affiliation</th>
              <th scope="col">Blocks</th><th scope="col">Notify</th><th scope="col">Source</th><th scope="col">Details</th>
              <th scope="col">Wall</th><th scope="col">Joined</th><th scope="col"><span className="sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{m.id}</td>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td>{AFFILIATION_LABELS[m.affiliation]}</td>
                <td>{m.blocks.join(", ")}</td>
                <td>{m.notify.join(", ")}</td>
                <td>{m.source}</td>
                <td>
                  {[m.role, m.company].filter(Boolean).join(", ")}
                  {m.school && <div>{m.school}{m.gradYear ? ` '${String(m.gradYear).slice(2)}` : ""}</div>}
                  {m.linkedinUrl && <div><a href={m.linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn</a></div>}
                </td>
                <td>
                  {m.showOnWall ? (
                    <form action={setWallApproved}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="approved" value={m.wallApproved ? "0" : "1"} />
                      <div>“{m.wallName}”</div>
                      <button type="submit">{m.wallApproved ? "Unapprove" : "Approve"}</button>
                    </form>
                  ) : "—"}
                </td>
                <td>{dateFmt.format(m.createdAt)}</td>
                <td>
                  <details className={styles.del}>
                    <summary>Delete</summary>
                    <form action={deleteMember}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="confirm" value="yes" />
                      <button type="submit">Delete #{m.id} permanently</button>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p>No members match these filters.</p>}
      </div>
    </>
  );
}
