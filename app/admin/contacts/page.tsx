import type { Metadata } from "next";
import { Suspense } from "react";
import { isSuper, type Admin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { listContacts, listSources, parseContactFilters } from "@/lib/contacts-query";
import { deleteContact } from "./actions";
import Guard from "../Guard";
import styles from "../admin.module.css";

export const metadata: Metadata = {
  title: "Contacts · Admin",
  robots: { index: false, follow: false },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function ContactsPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <h1>Contacts</h1>
      <p className={styles.lede}>People imported from lists such as conference registrations. Contacts aren&apos;t members: they have no block number and aren&apos;t counted as members. When one joins, they&apos;re linked to their member row.</p>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard>{(admin) => <Contacts searchParams={searchParams} admin={admin} />}</Guard>
      </Suspense>
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" });
const checked = (v: boolean | null) => (v === null ? "Unknown" : v ? "Yes" : "No");

async function Contacts({ searchParams, admin }: { searchParams: SP; admin: Admin }) {
  const f = parseContactFilters(await searchParams);
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const [rows, sources] = await Promise.all([listContacts(db, f), listSources(db)]);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <form className={styles.filters} method="get">
        <label>Source
          <select name="source" defaultValue={f.source ?? ""}>
            <option value="">Any</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Status
          <select name="status" defaultValue={f.status ?? ""}>
            <option value="">Any</option>
            <option value="converted">Joined (converted)</option>
            <option value="open">Not joined yet</option>
          </select>
        </label>
        <label>Checked in
          <select name="checkedIn" defaultValue={f.checkedIn ?? ""}>
            <option value="">Any</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <button type="submit">Filter</button>
        <a href="/admin/contacts">Clear</a>
        {isSuper(admin) && <a className={styles.export} href={`/admin/contacts/export${qs ? `?${qs}` : ""}`}>Export CSV ({rows.length})</a>}
      </form>

      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="sr">Contacts, newest first</caption>
          <thead>
            <tr>
              <th scope="col">ID</th><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Source</th>
              <th scope="col">Checked in</th><th scope="col">Member</th><th scope="col">Invited</th><th scope="col">Imported</th>
              <th scope="col"><span className="sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.name}</td>
                <td>{c.email}</td>
                <td>{c.source}</td>
                <td>{checked(c.checkedIn)}</td>
                <td>{c.memberId ? `Block #${c.memberId}` : "—"}</td>
                <td>{c.invitedAt ? dateFmt.format(c.invitedAt) : "—"}</td>
                <td>{dateFmt.format(c.importedAt)}</td>
                <td>
                  {isSuper(admin) && (
                    <details className={styles.del}>
                      <summary>Delete</summary>
                      <form action={deleteContact}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="confirm" value="yes" />
                        <button type="submit">Delete contact {c.id} permanently</button>
                      </form>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className={styles.empty}>No contacts match these filters.</p>}
      </div>
    </>
  );
}
