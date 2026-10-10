"use client";

import { useEffect, useState, useTransition } from "react";
import { NOTIFY } from "@/content/events";
import { industries } from "@/content/industries";
import type { AnnouncementFilters } from "@/lib/db/schema";
import { countRecipients, sendAnnouncement, sendTest, type CountResult, type SendResult } from "./actions";
import styles from "../admin.module.css";

type Props = { affiliations: [string, string][]; countries: string[] };

export default function Composer({ affiliations, countries }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [f, setF] = useState<AnnouncementFilters>({});
  const [count, setCount] = useState<CountResult | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);
  const [pending, start] = useTransition();

  // Live recipient count (debounced).
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => countRecipients(f).then((c) => live && setCount(c)).catch(() => live && setCount({ ok: false, error: "Couldn't count recipients." })), 250);
    return () => { live = false; clearTimeout(t); };
  }, [f]);

  const toggle = (k: "blocks" | "notify", v: string) => setF((x) => {
    const cur = new Set(x[k] ?? []); if (cur.has(v)) cur.delete(v); else cur.add(v);
    return { ...x, [k]: [...cur] };
  });
  const draft = { subject, body, filters: f };
  const n = count?.ok ? count.recipients : 0;
  const over = count?.ok ? n > count.remaining : false;

  const test = () => start(async () => { setResult(await sendTest(draft).catch(() => ({ ok: false as const, error: "The test didn't go out. Try again." }))); });
  const send = () => {
    if (!confirm(`Send "${subject}" to ${n} member${n === 1 ? "" : "s"}? This can't be undone.`)) return;
    start(async () => {
      const r = await sendAnnouncement(draft, n).catch(() => ({ ok: false as const, error: "The send didn't finish. Check the log below before trying again." }));
      setResult(r);
      if (r.ok) { setSubject(""); setBody(""); }
      countRecipients(f).then(setCount).catch(() => {});
    });
  };

  return (
    <div className={styles.compose}>
      <label className={styles.field}>Subject<input value={subject} onChange={(e) => { setSubject(e.target.value); setResult(null); }} maxLength={150} /></label>
      <label className={styles.field}>Message <span className={styles.note}>Plain text. Leave a blank line between paragraphs. An unsubscribe link is always added.</span>
        <textarea value={body} onChange={(e) => { setBody(e.target.value); setResult(null); }} rows={12} maxLength={8000} />
      </label>

      <fieldset className={styles.checks}>
        <legend>Blocks (any of; none = everyone)</legend>
        {industries.map((i) => <label key={i.id}><input type="checkbox" checked={f.blocks?.includes(i.id) ?? false} onChange={() => toggle("blocks", i.id)} />{i.name}</label>)}
      </fieldset>
      <fieldset className={styles.checks}>
        <legend>Notify interests (any of; none = everyone)</legend>
        {NOTIFY.map((v) => <label key={v}><input type="checkbox" checked={f.notify?.includes(v) ?? false} onChange={() => toggle("notify", v)} />{v}</label>)}
      </fieldset>
      <div className={styles.filters}>
        <label>Affiliation
          <select value={f.affiliation ?? ""} onChange={(e) => setF((x) => ({ ...x, affiliation: e.target.value || undefined }))}>
            <option value="">Any</option>
            {affiliations.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>Country
          <select value={f.country ?? ""} onChange={(e) => setF((x) => ({ ...x, country: e.target.value || undefined }))}>
            <option value="">Any</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      <p className={styles.note} role="status">
        {!count ? "Counting recipients…" : !count.ok ? count.error
          : <><b>{n}</b> recipient{n === 1 ? "" : "s"} (unsubscribed members are never included). {count.remaining} of today&apos;s {count.limit} emails left.</>}
      </p>
      {over && <p className={styles.err}>That&apos;s more than today&apos;s remaining limit. Narrow the filters or send later.</p>}
      <div className={styles.row}>
        <button type="button" onClick={test} disabled={pending || !subject.trim() || !body.trim()}>Send a test to me</button>
        <button type="button" className={styles.primary} onClick={send} disabled={pending || !n || over || !subject.trim() || !body.trim()}>
          {pending ? "Working…" : `Send to ${n} member${n === 1 ? "" : "s"}`}
        </button>
      </div>
      <p className={result?.ok === false ? styles.err : styles.note} role="status">{result ? (result.ok ? result.message : result.error) : "Send yourself a test of the final text first; the send button checks for it."}</p>
    </div>
  );
}
