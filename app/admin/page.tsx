import type { Metadata } from "next";
import { count, desc, inArray } from "drizzle-orm";
import { Suspense } from "react";
import { isSuper, type Admin } from "@/lib/admin";
import { NOTIFY } from "@/content/notify";
import { industries } from "@/content/industries";
import { getDb } from "@/lib/db";
import { adminAudit, AFFILIATIONS, pendingJoins, type AdminAudit, type Affiliation } from "@/lib/db/schema";
import { AFFILIATION_LABELS, listMembers, membersByCountry, parseFilters } from "@/lib/members-query";
import { listPendingJoins } from "@/lib/pending-joins";
import { approvePending, deleteMember, removePending } from "./actions";
import { NotSpamButton, SpamBadge } from "./Spam";
import EditMember from "./EditMember";
import Guard from "./Guard";
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
        <Guard>{(admin) => <Members searchParams={searchParams} admin={admin} />}</Guard>
      </Suspense>
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" });
const timeFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
const AFFILIATION_OPTIONS = AFFILIATIONS.map((a): [Affiliation, string] => [a, AFFILIATION_LABELS[a]]);

/** "email a@example.com → b@example.com · affiliation Alumni → Student" */
function describe(c: AdminAudit["changes"]) {
  const label = (k: string, v: string | null) => (k === "affiliation" && v ? AFFILIATION_LABELS[v as Affiliation] ?? v : v ?? "none");
  return Object.entries(c).map(([k, [from, to]]) => k === "contact" ? `linked contact ${to}` : `${k} ${label(k, from)} → ${label(k, to)}`).join(" · ");
}

async function Members({ searchParams, admin }: { searchParams: SP; admin: Admin }) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const [{ pending }] = await db.select({ pending: count() }).from(pendingJoins);
  if (sp.show === "pending") return <><ShowFilter show="pending" pending={pending} /><Pending admin={admin} /></>;
  const [rows, countries] = await Promise.all([listMembers(db, f), membersByCountry(db)]);
  // The last 3 admin edits per member shown, newest first.
  const audit = new Map<number, AdminAudit[]>();
  if (rows.length) {
    const log = await db.select().from(adminAudit).where(inArray(adminAudit.memberId, rows.map((m) => m.id))).orderBy(desc(adminAudit.createdAt));
    for (const a of log) { if (a.memberId === null) continue; const l = audit.get(a.memberId) ?? []; if (l.length < 3) audit.set(a.memberId, [...l, a]); }
  }
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <ShowFilter show="members" pending={pending} />
      {countries.length > 0 && (
        <section className={styles.mix} aria-labelledby="country-h">
          <h2 id="country-h">Members by country <span>From the optional &ldquo;City and country&rdquo; field, read from the part after the last comma. Counts only.</span></h2>
          <dl className={styles.counts}>
            {countries.map((c) => <div key={c.country ?? ""}><dt>{c.country ?? "Not given"}</dt><dd>{c.n}</dd></div>)}
          </dl>
        </section>
      )}

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
        <label>Country
          <select name="country" defaultValue={f.country ?? ""}>
            <option value="">Any</option>
            {countries.filter((c) => c.country).map((c) => <option key={c.country} value={c.country!}>{c.country} ({c.n})</option>)}
            {f.country && f.country !== "none" && !countries.some((c) => c.country === f.country) && <option value={f.country}>{f.country} (0)</option>}
            <option value="none">Not given</option>
          </select>
        </label>
        <button type="submit">Filter</button>
        <a href="/admin">Clear</a>
        {isSuper(admin) && <a className={styles.export} href={`/admin/export${qs ? `?${qs}` : ""}`}>Export CSV ({rows.length})</a>}
      </form>

      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="sr">Members, newest first</caption>
          <thead>
            <tr>
              <th scope="col">#</th><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Affiliation</th>
              <th scope="col">Blocks</th><th scope="col">Notify</th><th scope="col">Source</th><th scope="col">Details</th>
              <th scope="col">Joined</th><th scope="col"><span className="sr">Actions</span></th>
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
                  {m.location && <div>{m.location}</div>}
                  {m.linkedinUrl && <div><a href={m.linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn</a></div>}
                </td>
                <td>{dateFmt.format(m.createdAt)}</td>
                <td className={styles.actions}>
                  <details className={styles.editd}>
                    <summary>Edit</summary>
                    <EditMember m={{ id: m.id, name: m.name, email: m.email, affiliation: m.affiliation, blocks: m.blocks, notify: m.notify, linkedinUrl: m.linkedinUrl, role: m.role, company: m.company, school: m.school, gradYear: m.gradYear, location: m.location }} options={AFFILIATION_OPTIONS} />
                  </details>
                  {audit.has(m.id) && (
                    <ul className={styles.audit} aria-label={`Last edits to #${m.id}`}>
                      {audit.get(m.id)!.map((a) => (
                        <li key={a.id}><time dateTime={a.createdAt.toISOString()}>{timeFmt.format(a.createdAt)}</time> · {a.actor}: {describe(a.changes) || a.detail}</li>
                      ))}
                    </ul>
                  )}
                  {isSuper(admin) && (
                    <details className={styles.del}>
                      <summary>Delete</summary>
                      <form action={deleteMember}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="confirm" value="yes" />
                        <button type="submit">Delete #{m.id} permanently</button>
                      </form>
                    </details>
                  )}
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

/** Members, or the joins flagged as suspected spam (round 20), which aren't members until approved. */
function ShowFilter({ show, pending }: { show: "members" | "pending"; pending: number }) {
  return (
    <form className={styles.filters} method="get">
      <label>Show
        <select name="show" defaultValue={show === "pending" ? "pending" : ""}>
          <option value="">Members</option>
          <option value="pending">Pending: suspected spam ({pending})</option>
        </select>
      </label>
      <button type="submit">Show</button>
    </form>
  );
}

async function Pending({ admin }: { admin: Admin }) {
  const db = getDb()!;
  const rows = await listPendingJoins(db);
  return (
    <>
      <p className={styles.lede}>Joins and event check-in joins the spam check flagged (the hidden field was filled, or the form was sent too fast). They aren&apos;t members: no block number, no emails, not counted. &ldquo;Not spam&rdquo; makes the person a member, sends the welcome email it skipped and, for a check-in join of a new member, checks them in. Delete removes it.</p>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="sr">Pending joins flagged as suspected spam, newest first</caption>
          <thead><tr><th scope="col">Received (ET)</th><th scope="col">Name</th><th scope="col">Email</th><th scope="col">From</th><th scope="col">Flag</th></tr></thead>
          <tbody>
            {rows.map(({ p, eventTitle }) => (
              <tr key={p.id}>
                <td>{timeFmt.format(p.createdAt)}<div className={styles.note}>Pending #{p.id}</div></td>
                <td>{p.name}<div className={styles.note}>{AFFILIATION_LABELS[p.affiliation]}{p.blocks.length ? ` · ${p.blocks.join(", ")}` : ""}</div></td>
                <td><a href={`mailto:${p.email}`}>{p.email}</a></td>
                <td>{p.kind === "checkin" ? <>Check-in{eventTitle ? `: ${eventTitle}` : ""}</> : "Join"}{p.source && <div className={styles.note}>{p.source}</div>}{p.notify.length > 0 && <div className={styles.note}>Notify: {p.notify.join(", ")}</div>}</td>
                <td>
                  <SpamBadge reason={p.spamReason} />
                  {isSuper(admin) && <NotSpamButton action={approvePending} id={p.id} what="pending join" />}
                  {isSuper(admin) && (
                    <details className={styles.del}>
                      <summary>Delete</summary>
                      <form action={removePending}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="confirm" value="yes" />
                        <button type="submit">Delete pending #{p.id} permanently</button>
                      </form>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className={styles.empty}>Nothing pending.</p>}
        {!isSuper(admin) && rows.length > 0 && <p className={styles.empty}>Read-only: super admins decide.</p>}
      </div>
    </>
  );
}
