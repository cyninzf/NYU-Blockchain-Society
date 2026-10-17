import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { isSuper, type Admin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { nameMatches, type Review } from "@/lib/contact-links";
import { countContacts, INVITE_STATUS_LABELS, INVITE_STATUSES, listContacts, listSources, parseContactFilters } from "@/lib/contacts-query";
import { CONTACT_FOCUS, CONTACT_FOCUS_LABELS, CONTACT_TYPE_LABELS, CONTACT_TYPES, INVESTOR_STAGE_LABELS, INVESTOR_STAGES, RELATIONSHIP_LABELS, RELATIONSHIPS } from "@/lib/contact-fields";
import { PAGE_SIZE, pageWindow, parsePage } from "@/lib/paging";
import { linkedInterest } from "@/lib/contact-save";
import Pager from "../Pager";
import { linkContact } from "./actions";
import ContactsTable, { LinkForm } from "./ContactsTable";
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
      <p className={styles.lede}>People imported from lists such as conference registrations (with email) or the LinkedIn group (name and headline, no email), added by hand, or from the accelerator forms. Type, focus, stage, LinkedIn, NYU alum and relationship are for organizers only and never change who can be invited. Contacts aren&apos;t members: they have no block number and aren&apos;t counted as members. When one joins they&apos;re linked to their member automatically: by email, or for contacts without an email by an exact name match. Unclear name matches wait under Needs a look; Undo removes a link for good.</p>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard>{(admin) => <Contacts searchParams={searchParams} admin={admin} />}</Guard>
      </Suspense>
    </>
  );
}


async function Contacts({ searchParams, admin }: { searchParams: SP; admin: Admin }) {
  const sp = await searchParams;
  const f = parseContactFilters(sp);
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const total = await countContacts(db, f);
  const pg = pageWindow(parsePage(sp), total);
  const [rows, sources, { review }] = await Promise.all([listContacts(db, f, { limit: PAGE_SIZE, offset: pg.offset }), listSources(db), nameMatches(db)]);
  const linked = await linkedInterest(db, rows.map((r) => r.c.id));
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      {review.length > 0 && <NeedsALook review={review} />}

      <form className={styles.filters} method="get">
        <label>Search
          <input name="q" type="search" defaultValue={f.q ?? ""} placeholder="Name, email, headline, company, LinkedIn or notes" />
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
        <label>Invite
          <select name="invite" defaultValue={f.invite ?? ""}>
            <option value="">Any</option>
            {INVITE_STATUSES.map((s) => <option key={s} value={s}>{INVITE_STATUS_LABELS[s]}</option>)}
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
        <label>Type
          <select name="type" defaultValue={f.type ?? ""}>
            <option value="">Any</option>
            {CONTACT_TYPES.map((t) => <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>)}
            <option value="none">Not set</option>
          </select>
        </label>
        <label>Focus
          <select name="focus" defaultValue={f.focus ?? ""}>
            <option value="">Any</option>
            {CONTACT_FOCUS.map((t) => <option key={t} value={t}>{CONTACT_FOCUS_LABELS[t]}</option>)}
          </select>
        </label>
        <label>Stage
          <select name="stage" defaultValue={f.stage ?? ""}>
            <option value="">Any</option>
            {INVESTOR_STAGES.map((t) => <option key={t} value={t}>{INVESTOR_STAGE_LABELS[t]}</option>)}
          </select>
        </label>
        <label>Relationship
          <select name="relationship" defaultValue={f.relationship ?? ""}>
            <option value="">Any</option>
            {RELATIONSHIPS.map((t) => <option key={t} value={t}>{RELATIONSHIP_LABELS[t]}</option>)}
          </select>
        </label>
        <button type="submit">Filter</button>
        <Link href="/admin/contacts">Clear</Link>
        <Link className={styles.button} href="/admin/contacts/new">Add contact</Link>
        {isSuper(admin) && <Link className={`${styles.button} ${styles.primary}`} href="/admin/contacts/import">Import</Link>}
        {isSuper(admin) && <Link className={styles.button} href="/admin/contacts/invite">Invite</Link>}
        {isSuper(admin) && <a className={styles.export} href={`/admin/contacts/export${qs ? `?${qs}` : ""}`}>Export CSV ({total})</a>}
      </form>

      <ContactsTable rows={rows} linked={linked} isSuper={isSuper(admin)} />
      <Pager path="/admin/contacts" qs={qs} page={pg.page} last={pg.last} total={total} shown={rows.length} label="Contacts" />
    </>
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
