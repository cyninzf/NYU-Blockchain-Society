"use client";

import { useEffect, useState } from "react";
import { PROTECTED_TICK, PROTECTED_WARNING, type ProtectedKind } from "@/lib/contacts-import";
import { countEligible, previewInvite, sendInviteTest, startInviteCampaign, type InviteInput, type InviteResult } from "./actions";
import styles from "../../admin.module.css";

type Props = {
  /**
   * `kind`: a protected source, "personal" (via-, personal introductions) or "form" (accelerator-form,
   * investor-list): never pre-selected, sent only after the explicit tick and warning. Null for the rest.
   */
  sources: { source: string; eligible: number; kind: ProtectedKind | null }[];
  events: { id: number; label: string }[];
  defaults: { subject: string; body: string; reason: string };
  hasAddress: boolean;
};

/** Pick a source and an optional event, edit the invite, preview it live, test it, then send. */
export default function Composer({ sources, events, defaults, hasAddress }: Props) {
  // Never a protected source by default: those are picked by hand or not at all.
  const general = sources.filter((s) => !s.kind), personalSources = sources.filter((s) => s.kind === "personal"), formSources = sources.filter((s) => s.kind === "form");
  const [source, setSource] = useState(general.find((s) => s.eligible)?.source ?? general[0]?.source ?? "");
  const [includePersonal, setIncludePersonal] = useState(false);
  const kind = sources.find((s) => s.source === source)?.kind ?? null, personal = kind !== null;
  const [eventId, setEventId] = useState<number | null>(null);
  const [subject, setSubject] = useState(defaults.subject);
  const [body, setBody] = useState(defaults.body);
  const [reason, setReason] = useState(defaults.reason);
  const [n, setN] = useState<number | null>(null);
  const [html, setHtml] = useState("");
  const [result, setResult] = useState<InviteResult | null>(null);
  const [pending, setPending] = useState(false);
  const input: InviteInput = { subject, body, reason, source, eventId, includePersonal: personal && includePersonal };

  useEffect(() => {
    let alive = true;
    if (source) countEligible(source).then((c) => alive && setN(c)).catch(() => {});
    return () => { alive = false; };
  }, [source]);

  // Live preview, a moment after typing stops.
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      previewInvite({ subject, body, reason, source, eventId }).then((r) => { if (alive && "html" in r) setHtml(r.html); }).catch(() => {});
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [subject, body, reason, source, eventId]);

  const run = async (f: () => Promise<InviteResult>) => {
    setPending(true); setResult(null);
    try { setResult(await f()); } catch { setResult({ ok: false, error: "That didn't work. Check that you're still signed in and try again." }); } finally { setPending(false); }
  };
  const send = () => {
    if (n === null || (personal && !includePersonal)) return;
    if (!confirm(`${kind ? `${PROTECTED_WARNING[kind]}\n\n` : ""}Queue a one-time invite to ${n} contact${n === 1 ? "" : "s"} from ${source}? Each can only ever be invited once.`)) return;
    run(() => startInviteCampaign(input, n));
  };

  return (
    <div className={styles.compose}>
      {!hasAddress && <p className={styles.err} role="alert">No postal address is set. Add it in <a href="/admin/settings">Settings</a>: tests and sends are blocked until then.</p>}
      <div className={styles.row}>
        <label className={styles.field}>Contacts from
          <select value={source} onChange={(e) => { setSource(e.target.value); setN(null); setIncludePersonal(false); }}>
            {!source && <option value="">Pick a source</option>}
            {general.map((s) => <option key={s.source} value={s.source}>{s.source} ({s.eligible} eligible)</option>)}
            {personalSources.length > 0 && (
              <optgroup label="Personal introductions (not auto-invited)">
                {personalSources.map((s) => <option key={s.source} value={s.source}>{s.source} ({s.eligible} personal)</option>)}
              </optgroup>
            )}
            {formSources.length > 0 && (
              <optgroup label="Form submissions (not auto-invited)">
                {formSources.map((s) => <option key={s.source} value={s.source}>{s.source} ({s.eligible} from forms)</option>)}
              </optgroup>
            )}
          </select>
        </label>
        <label className={styles.field}>Feature an event (optional)
          <select value={eventId ?? ""} onChange={(e) => setEventId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">None</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </label>
      </div>
      <p className={styles.note} role="status">{!source ? "Pick a source." : n === null ? "Counting…" : `${n} ${kind === "personal" ? "personal introduction" : kind === "form" ? "form submission" : "eligible contact"}${n === 1 ? "" : "s"}: a valid email, not a member, never invited, not unsubscribed or bounced.`}</p>
      {kind && (
        <div className={styles.warn} role="alert">
          <p><strong>{PROTECTED_WARNING[kind]}</strong> They&apos;re never invited unless you include them here.</p>
          <label><input type="checkbox" checked={includePersonal} onChange={(e) => setIncludePersonal(e.target.checked)} /> {PROTECTED_TICK[kind]} ({source}) in this invite</label>
        </div>
      )}
      <label className={styles.field}>Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} /></label>
      <label className={styles.field}>Message <span className={styles.note}>Blank line = new paragraph. {"{first_name}"} becomes their first name.</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} maxLength={4000} />
      </label>
      <label className={styles.field}>Why they&apos;re receiving it (footer)<input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></label>
      <h2 className={styles.h2}>Preview</h2>
      <iframe className={styles.mailPreview} title="Invite preview" srcDoc={html} sandbox="" />
      <div className={styles.row}>
        <button type="button" onClick={() => run(() => sendInviteTest(input))} disabled={pending || !hasAddress}>Send a test to me</button>
        <button type="button" className={styles.primary} onClick={send} disabled={pending || !hasAddress || !n || (personal && !includePersonal)}>{pending ? "Working…" : `Send to ${n ?? 0} contact${n === 1 ? "" : "s"}`}</button>
      </div>
      <p className={result?.ok === false ? styles.err : styles.note} role="status">
        {result ? (result.ok ? result.message : result.error) : "Send yourself a test of the final invite first; the send button checks for it."}
      </p>
    </div>
  );
}
