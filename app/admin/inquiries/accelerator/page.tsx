import type { Metadata } from "next";
import { Suspense } from "react";
import { AFFILIATION_LABELS, FOCUS, FOCUS_LABELS, HELP_LABELS, STAGE_LABELS } from "@/content/accelerator";
import { listInterest, parseInterestFilters } from "@/lib/accelerator-interest";
import { isSuper, type Admin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { FOUNDER_STAGES, INTEREST_STATUSES, type InterestStatus } from "@/lib/db/schema";
import Guard from "../../Guard";
import styles from "../../admin.module.css";
import InquiryTabs from "../InquiryTabs";
import { changeInterestStatus, removeInterest } from "./actions";

export const metadata: Metadata = { title: "Accelerator interest · Admin", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function AcceleratorInterestPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <h1>Inquiries</h1>
      <InquiryTabs current="accelerator" />
      <p className={styles.lede}>Founders and supporters from /accelerator. Each one also went by email to the recovery super admin, with Reply going to the submitter. They aren&apos;t contacts or members unless a founder ticked &ldquo;Also add me as a member&rdquo;.</p>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard>{(admin) => <Interest admin={admin} searchParams={searchParams} />}</Guard>
      </Suspense>
    </>
  );
}

const SHOWN = 300;
const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
const LABEL: Record<InterestStatus, string> = { new: "New", contacted: "Contacted", closed: "Closed" };
const list = <K extends string>(keys: K[], labels: Record<K, string>) => keys.map((k) => labels[k] ?? k).join(", ");

async function Interest({ admin, searchParams }: { admin: Admin; searchParams: SP }) {
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const f = parseInterestFilters(await searchParams);
  const rows = await listInterest(db, f, SHOWN);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <>
      <form className={styles.filters} method="get">
        <label>Type
          <select name="type" defaultValue={f.type ?? ""}>
            <option value="">Any</option><option value="founder">Founders</option><option value="supporter">Supporters</option>
          </select>
        </label>
        <label>Stage
          <select name="stage" defaultValue={f.stage ?? ""}>
            <option value="">Any</option>
            {FOUNDER_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
        </label>
        <label>Focus
          <select name="focus" defaultValue={f.focus ?? ""}>
            <option value="">Any</option>
            {FOCUS.map((s) => <option key={s} value={s}>{FOCUS_LABELS[s]}</option>)}
          </select>
        </label>
        <label>Status
          <select name="status" defaultValue={f.status ?? ""}>
            <option value="">Any</option>
            {INTEREST_STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
          </select>
        </label>
        <button type="submit">Filter</button>
        {isSuper(admin)
          ? <a className={styles.export} href={`/admin/inquiries/accelerator/export${qs ? `?${qs}` : ""}`}>Export CSV</a>
          : <span className={styles.note}>Read-only: super admins change the status, export and delete.</span>}
      </form>
      {(f.stage || f.focus) && <p className={styles.note}>Stage and focus apply to founders only.</p>}
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="sr">Accelerator interest, newest first</caption>
          <thead><tr><th scope="col">Received (ET)</th><th scope="col">From</th><th scope="col">Type</th><th scope="col">Details</th><th scope="col">Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{dateFmt.format(r.createdAt)}<div className={styles.note}>#{r.id}</div></td>
                <td>{r.name}<div><a href={`mailto:${r.email}`}>{r.email}</a></div>{r.affiliation && <div className={styles.note}>{AFFILIATION_LABELS[r.affiliation]}</div>}</td>
                <td>{r.type === "founder" ? "Founder" : "Supporter"}{r.addMember && <div className={styles.note}>Also joined as a member</div>}</td>
                <td style={{ maxWidth: 460 }}>
                  {r.type === "founder" ? (
                    <>
                      <b>{r.company}</b>{r.website && <> · <a href={r.website} target="_blank" rel="noopener noreferrer nofollow">{r.website.replace(/^https?:\/\//, "")}</a></>}
                      <div>{r.oneLiner}</div>
                      <div className={styles.note}>{r.stage && STAGE_LABELS[r.stage]} · {list(r.focus as (typeof FOCUS)[number][], FOCUS_LABELS)}</div>
                    </>
                  ) : (
                    <>
                      <b>{r.organization}</b>
                      <div className={styles.note}>Would like to: {list(r.help as (keyof typeof HELP_LABELS)[], HELP_LABELS)}</div>
                      {r.message && <div style={{ whiteSpace: "pre-line" }}>{r.message}</div>}
                    </>
                  )}
                </td>
                <td>
                  {isSuper(admin) ? (
                    <form action={changeInterestStatus} className={styles.row}>
                      <input type="hidden" name="id" value={r.id} />
                      <select name="status" defaultValue={r.status} aria-label={`Status of accelerator interest ${r.id}`}>
                        {INTEREST_STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                      </select>
                      <button type="submit">Save</button>
                    </form>
                  ) : <span className={styles.badge}>{LABEL[r.status]}</span>}
                  {isSuper(admin) && (
                    <details className={styles.del}>
                      <summary>Delete</summary>
                      <form action={removeInterest}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="confirm" value="yes" />
                        <button type="submit">Delete #{r.id} permanently</button>
                      </form>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className={styles.empty}>Nothing here{qs ? " for these filters" : " yet"}.</p>}
        {rows.length === SHOWN && <p className={styles.empty}>Showing the newest {SHOWN}{isSuper(admin) ? "; the CSV export has all of them" : ""}.</p>}
      </div>
    </>
  );
}
