import Link from "next/link";
import { LINK_LABELS } from "@/lib/contact-links";
import { INVITE_STATUS_LABELS, type listContacts } from "@/lib/contacts-query";
import { CONTACT_FOCUS_LABELS, CONTACT_TYPE_LABELS, INVESTOR_STAGE_LABELS, nyuAlumLabel, RELATIONSHIP_LABELS, type ContactFocus } from "@/lib/contact-fields";
import type { linkedInterest } from "@/lib/contact-save";
import MoreColumns from "../MoreColumns";
import { deleteContact, linkContact, unlinkContact } from "./actions";
import styles from "../admin.module.css";

// The contacts table (round 28.2, moved out of page.tsx): default columns Name (company and
// LinkedIn under it), Email, Type, Focus, Relationship, Last touch, Source, Invite and the actions;
// the rest behind "More columns" (remembered per browser). IDs, emails, sources, dates, statuses
// and actions never break; names and notes wrap at word boundaries; a table too wide scrolls inside
// its own container.

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" });
const checked = (v: boolean | null) => (v === null ? "Unknown" : v ? "Yes" : "No");

type Rows = Awaited<ReturnType<typeof listContacts>>;
type Linked = Awaited<ReturnType<typeof linkedInterest>>;

export default function ContactsTable({ rows, linked, isSuper }: { rows: Rows; linked: Linked; isSuper: boolean }) {
  return (
    <MoreColumns storageKey="nyubs:admin-contacts-more">
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="sr">Contacts, newest first</caption>
          <thead>
            <tr>
              <th scope="col" className={`${styles.more} ${styles.nowrap}`}>ID</th><th scope="col">Name</th><th scope="col">Email</th>
              <th scope="col">Type</th><th scope="col">Focus</th><th scope="col" className={styles.more}>Stage</th><th scope="col" className={styles.more}>NYU alum</th>
              <th scope="col" className={styles.nowrap}>Relationship</th><th scope="col" className={styles.nowrap}>Last touch</th><th scope="col">Source</th>
              <th scope="col" className={styles.more}>Headline</th><th scope="col" className={styles.more}>Notes</th>
              <th scope="col" className={`${styles.more} ${styles.nowrap}`}>Checked in</th><th scope="col" className={`${styles.more} ${styles.nowrap}`}>Linked member</th>
              <th scope="col">Invite</th><th scope="col" className={styles.more}>Imported</th>
              <th scope="col"><span className="sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, memberName, invite }) => (
              <tr key={c.id}>
                <td className={`${styles.more} ${styles.nowrap}`}>{c.id}</td>
                <td className={styles.words}>
                  {c.name ?? "—"}
                  {c.company && <span className={styles.sub}>{c.company}</span>}
                  {c.linkedinUrl && <span className={styles.sub}><a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow">LinkedIn</a></span>}
                </td>
                <td className={styles.nowrap}>{c.email ?? "—"}</td>
                <td className={styles.nowrap}>{c.contactType ? CONTACT_TYPE_LABELS[c.contactType] : ""}</td>
                <td className={styles.nowrap}>{(c.focus as ContactFocus[]).map((x) => CONTACT_FOCUS_LABELS[x] ?? x).join(", ")}</td>
                <td className={`${styles.more} ${styles.nowrap}`}>{c.stage ? INVESTOR_STAGE_LABELS[c.stage] : ""}</td>
                <td className={`${styles.more} ${styles.nowrap}`}>{nyuAlumLabel(c.nyuAlum)}</td>
                <td className={styles.nowrap}>{RELATIONSHIP_LABELS[c.relationship] ?? c.relationship}</td>
                <td className={styles.nowrap}>{c.lastTouchAt ?? ""}</td>
                <td className={styles.nowrap}>{c.source}</td>
                <td className={`${styles.more} ${styles.words}`}>{c.headline}</td>
                <td className={`${styles.more} ${styles.words} ${styles.notes}`}>{c.notes}</td>
                <td className={`${styles.more} ${styles.nowrap}`}>{checked(c.checkedIn)}</td>
                <td className={`${styles.more} ${styles.nowrap}`}>{c.memberId ? (
                  <form action={unlinkContact}>
                    <input type="hidden" name="id" value={c.id} />
                    <div>Block #{c.memberId}{memberName ? ` · ${memberName}` : ""}</div>
                    <div className={styles.row}><span className={styles.badge}>{LINK_LABELS[c.linkMethod ?? ""] ?? "linked"}</span><button type="submit">Undo</button></div>
                  </form>
                ) : <LinkForm id={c.id} />}</td>
                <td className={styles.nowrap}>{INVITE_STATUS_LABELS[invite]}{c.invitedAt && <span className={styles.sub}>Invited {dateFmt.format(c.invitedAt)}</span>}</td>
                <td className={`${styles.more} ${styles.nowrap}`}>{dateFmt.format(c.importedAt)}</td>
                <td>
                  <div className={styles.acts}>
                    <Link href={`/admin/contacts/${c.id}`} aria-label={`Edit contact ${c.id}`}>Edit</Link>
                    {isSuper && (
                      <details className={styles.del}>
                        <summary aria-label={`Delete contact ${c.id}`}>Delete</summary>
                        <form action={deleteContact}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="confirm" value="yes" />
                          {linked.get(c.id) && <label className={styles.row}><input type="checkbox" name="alsoLinked" /> Also delete the linked {linked.get(c.id)!.length === 1 ? "record" : "records"} (accelerator {linked.get(c.id)!.map((l) => `#${l.id}`).join(", ")})</label>}
                          <button type="submit">Delete contact {c.id} permanently</button>
                        </form>
                      </details>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className={styles.empty}>No contacts match these filters.</p>}
      </div>
    </MoreColumns>
  );
}

/** Block-number field for linking by hand. */
export function LinkForm({ id }: { id: number }) {
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

