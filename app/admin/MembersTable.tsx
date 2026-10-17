import { AFFILIATIONS, type AdminAudit, type Affiliation } from "@/lib/db/schema";
import { AFFILIATION_LABELS, type listMembers } from "@/lib/members-query";
import { deleteMember } from "./actions";
import EditMember from "./EditMember";
import styles from "./admin.module.css";

// The members table (round 28.2, moved out of page.tsx): the #, email, source and date never break
// mid-word; names and details wrap at word boundaries; Edit and Delete sit side by side; a table
// too wide scrolls inside its own container.

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" });
const timeFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
const AFFILIATION_OPTIONS = AFFILIATIONS.map((a): [Affiliation, string] => [a, AFFILIATION_LABELS[a]]);

/** "email a@example.com → b@example.com · affiliation Alumni → Student" */
function describe(c: AdminAudit["changes"]) {
  const label = (k: string, v: string | null) => (k === "affiliation" && v ? AFFILIATION_LABELS[v as Affiliation] ?? v : v ?? "none");
  return Object.entries(c).map(([k, [from, to]]) => k === "contact" ? `linked contact ${to}` : `${k} ${label(k, from)} → ${label(k, to)}`).join(" · ");
}

type Rows = Awaited<ReturnType<typeof listMembers>>;

export default function MembersTable({ rows, audit, isSuper }: { rows: Rows; audit: Map<number, AdminAudit[]>; isSuper: boolean }) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <caption className="sr">Members, newest first</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.nowrap}>#</th><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Affiliation</th>
            <th scope="col">Blocks</th><th scope="col">Notify</th><th scope="col">Source</th><th scope="col">Details</th>
            <th scope="col">Joined</th><th scope="col"><span className="sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td className={styles.nowrap}>{m.id}</td>
              <td className={styles.words}>{m.name}</td>
              <td className={styles.nowrap}>{m.email}</td>
              <td className={styles.nowrap}>{AFFILIATION_LABELS[m.affiliation]}</td>
              <td className={styles.nowrap}>{m.blocks.join(", ")}</td>
              <td className={styles.nowrap}>{m.notify.join(", ")}</td>
              <td className={styles.nowrap}>{m.source}</td>
              <td className={styles.words}>
                {[m.role, m.company].filter(Boolean).join(", ")}
                {m.school && <div>{m.school}{m.gradYear ? ` '${String(m.gradYear).slice(2)}` : ""}</div>}
                {m.location && <div>{m.location}</div>}
                {m.linkedinUrl && <div><a href={m.linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn</a></div>}
              </td>
              <td className={styles.nowrap}>{dateFmt.format(m.createdAt)}</td>
              <td className={styles.actions}>
                <div className={styles.acts}>
                <details className={styles.editd}>
                  <summary aria-label={`Edit member ${m.id}`}>Edit</summary>
                  <EditMember m={{ id: m.id, name: m.name, email: m.email, affiliation: m.affiliation, blocks: m.blocks, notify: m.notify, linkedinUrl: m.linkedinUrl, role: m.role, company: m.company, school: m.school, gradYear: m.gradYear, location: m.location }} options={AFFILIATION_OPTIONS} />
                </details>
                {isSuper && (
                  <details className={styles.del}>
                    <summary aria-label={`Delete member ${m.id}`}>Delete</summary>
                    <form action={deleteMember}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="confirm" value="yes" />
                      <button type="submit">Delete #{m.id} permanently</button>
                    </form>
                  </details>
                )}
                </div>
                {audit.has(m.id) && (
                  <ul className={styles.audit} aria-label={`Last edits to #${m.id}`}>
                    {audit.get(m.id)!.map((a) => (
                      <li key={a.id}><time dateTime={a.createdAt.toISOString()}>{timeFmt.format(a.createdAt)}</time> · {a.actor}: {describe(a.changes) || a.detail}</li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p>No members match these filters.</p>}
    </div>
  );
}
