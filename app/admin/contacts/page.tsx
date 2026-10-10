import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { isSuper, type Admin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { LINK_LABELS, nameMatches, type Review } from "@/lib/contact-links";
import { listContacts, listSources, parseContactFilters } from "@/lib/contacts-query";
import { deleteContact, linkContact, unlinkContact } from "./actions";
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
      <p className={styles.lede}>People imported from lists such as conference registrations (with email) or the LinkedIn group (name and headline, no email). Contacts aren&apos;t members: they have no block number and aren&apos;t counted as members. When one joins they&apos;re linked to their member automatically: by email, or for contacts without an email by an exact name match. Unclear name matches wait under Needs a look; Undo removes a link for good.</p>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard>{(admin) => <Contacts searchParams={searchParams} admin={admin} />}</Guard>
      </Suspense>
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" });
const SHOWN = 200;
const checked = (v: boolean | null) => (v === null ? "Unknown" : v ? "Yes" : "No");

async function Contacts({ searchParams, admin }: { searchParams: SP; admin: Admin }) {
  const f = parseContactFilters(await searchParams);
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const [rows, sources, { review }] = await Promise.all([listContacts(db, f), listSources(db), nameMatches(db)]);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      {review.length > 0 && <NeedsALook review={review} />}

      <form className={styles.filters} method="get">
        <label>Search
          <input name="q" type="search" defaultValue={f.q ?? ""} placeholder="Name, email or headline" />
        </label>
        <label>Source
          <select name="source" defaultValue={f.source ?? ""}>
            <option value="">Any</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Linked
          <select name="linked" defaultValue={f.linked ?? ""}>
            <option value="">Any</option>
            <option value="yes">Linked to a member</option>
            <option value="no">Not linked</option>
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
        {isSuper(admin) && <Link className={`${styles.button} ${styles.primary}`} href="/admin/contacts/import">Import</Link>}
        {isSuper(admin) && <a className={styles.export} href={`/admin/contacts/export${qs ? `?${qs}` : ""}`}>Export CSV ({rows.length})</a>}
      </form>

      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="sr">Contacts, newest first</caption>
          <thead>
            <tr>
              <th scope="col">ID</th><th scope="col">Name</th><th scope="col">Headline</th><th scope="col">Email</th><th scope="col">Source</th>
              <th scope="col">Checked in</th><th scope="col">Linked member</th><th scope="col">Invited</th><th scope="col">Imported</th>
              <th scope="col"><span className="sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, SHOWN).map(({ c, memberName }) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.name}</td>
                <td>{c.headline}</td>
                <td>{c.email ?? "—"}</td>
                <td>{c.source}</td>
                <td>{checked(c.checkedIn)}</td>
                <td>{c.memberId ? (
                  <form action={unlinkContact}>
                    <input type="hidden" name="id" value={c.id} />
                    <div>Block #{c.memberId}{memberName ? ` · ${memberName}` : ""}</div>
                    <div className={styles.row}><span className={styles.badge}>{LINK_LABELS[c.linkMethod ?? ""] ?? "linked"}</span><button type="submit">Undo</button></div>
                  </form>
                ) : <LinkForm id={c.id} />}</td>
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
        {rows.length > SHOWN && <p className={styles.empty}>Showing the first {SHOWN} of {rows.length}. Search or filter to narrow it down{isSuper(admin) ? "; the CSV export has all of them" : ""}.</p>}
      </div>
    </>
  );
}

/** Block-number field for linking by hand. */
function LinkForm({ id }: { id: number }) {
  return (
    <details className={styles.editd}>
      <summary>Link to member</summary>
      <form action={linkContact} className={styles.row}>
        <input type="hidden" name="id" value={id} />
        <label>Block number<input name="memberId" inputMode="numeric" pattern="#?[0-9]*" required /></label>
        <button type="submit">Link</button>
      </form>
    </details>
  );
}

/** Contacts without an email whose name matches more than one member, or shares its name with another contact. */
function NeedsALook({ review }: { review: Review[] }) {
  return (
    <section className={styles.mix} id="review" aria-labelledby="review-h">
      <h2 id="review-h">Needs a look ({review.length}) <span>Same name as more than one member, or as another contact without an email, so nothing was linked automatically. Link the right one by hand.</span></h2>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Contact</th><th scope="col">Headline</th><th scope="col">Source</th><th scope="col">Possible members</th></tr></thead>
          <tbody>
            {review.map(({ contact: c, candidates }) => (
              <tr key={c.id}>
                <td>#{c.id} · {c.name}</td>
                <td>{c.headline}</td>
                <td>{c.source}</td>
                <td>
                  <div className={styles.edit}>
                    {candidates.map((m) => (
                      <form key={m.id} action={linkContact}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="memberId" value={m.id} />
                        <button type="submit">Link #{m.id} · {m.name}</button>
                      </form>
                    ))}
                    <LinkForm id={c.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
