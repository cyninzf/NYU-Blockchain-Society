import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { and, asc, desc, eq, gt, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { contacts, events, inviteCampaigns } from "@/lib/db/schema";
import { eventWhen } from "@/lib/event-time";
import { DEFAULT_INVITE } from "@/lib/invite-email";
import { campaignProgress, INVITE_RESERVE } from "@/lib/invite-queue";
import { queueableWhere } from "@/lib/invites";
import { postalAddress } from "@/lib/settings";
import { DAILY_EMAIL_LIMIT } from "@/lib/email";
import { setCampaignPaused } from "./actions";
import Composer from "./Composer";
import Guard from "../../Guard";
import styles from "../../admin.module.css";

export const metadata: Metadata = { title: "Invite contacts · Admin", robots: { index: false, follow: false } };

export default function InvitePage() {
  return (
    <>
      <h1>Invite contacts</h1>
      <p><Link href="/admin/contacts">Back to contacts</Link></p>
      <p className={styles.lede}>A one-time invitation to add their block. Each contact can be invited once, ever; anyone who unsubscribes, bounces or reports spam is never emailed again. Sends are queued: each day uses what&apos;s left of the {DAILY_EMAIL_LIMIT}-email limit (keeping {INVITE_RESERVE} for sign-in links and welcome emails), and a daily run continues until done.</p>
      <Suspense fallback={<p>Loading…</p>}>
        <Guard min="super_admin">{() => <Invite />}</Guard>
      </Suspense>
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
const STATUS: Record<string, string> = { queued: "Sending", paused: "Paused", done: "Done" };

async function Invite() {
  const db = getDb();
  if (!db) return <p>DATABASE_URL is not set for this environment.</p>;
  const [sources, upcoming, campaigns, address] = await Promise.all([
    db.select({ source: contacts.source, eligible: sql<number>`count(*) filter (where ${queueableWhere()})::int` })
      .from(contacts).groupBy(contacts.source).orderBy(contacts.source),
    db.select({ id: events.id, title: events.title, startsAt: events.startsAt, endsAt: events.endsAt }).from(events)
      .where(and(eq(events.status, "published"), gt(sql`coalesce(${events.endsAt}, ${events.startsAt})`, sql`now()`))).orderBy(asc(events.startsAt)),
    db.select().from(inviteCampaigns).where(ne(inviteCampaigns.status, "test")).orderBy(desc(inviteCampaigns.id)).limit(20),
    postalAddress(db),
  ]);
  const progress = await campaignProgress(db, campaigns.map((c) => c.id));
  return (
    <>
      {sources.length ? (
        <Composer
          sources={sources.filter((s) => s.eligible > 0).length ? sources.filter((s) => s.eligible > 0) : sources}
          events={upcoming.map((e) => ({ id: e.id, label: `${e.title} · ${eventWhen(e.startsAt, e.endsAt)}` }))}
          defaults={DEFAULT_INVITE}
          hasAddress={Boolean(address)}
        />
      ) : <p className={styles.empty}>No contacts yet. <Link href="/admin/contacts/import">Import a list</Link> first.</p>}

      <h2 className={styles.h2}>Campaigns</h2>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Started (ET)</th><th scope="col">Campaign</th><th scope="col">Queued</th><th scope="col">Sent</th><th scope="col">Failed</th><th scope="col">Skipped</th><th scope="col">Status</th><th scope="col"><span className="sr">Actions</span></th></tr></thead>
          <tbody>
            {campaigns.map((c) => {
              const p = progress.get(c.id) ?? {};
              return (
                <tr key={c.id}>
                  <td>{dateFmt.format(c.createdAt)}</td>
                  <td>#{c.id} · {c.subject}<div className={styles.note}>{c.source} · {c.total} contacts · by {c.createdBy}</div></td>
                  <td>{(p.queued ?? 0) + (p.sending ?? 0)}</td>
                  <td>{p.sent ?? 0}</td>
                  <td>{p.failed ?? 0}</td>
                  <td>{p.skipped ?? 0}</td>
                  <td><span className={styles.badge}>{STATUS[c.status] ?? c.status}</span></td>
                  <td>
                    {(c.status === "queued" || c.status === "paused") && (
                      <form action={setCampaignPaused}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="pause" value={c.status === "queued" ? "1" : "0"} />
                        <button type="submit">{c.status === "queued" ? "Pause" : "Resume"}</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!campaigns.length && <p className={styles.empty}>No campaigns yet.</p>}
      </div>
    </>
  );
}
