"use client";

// Quick-add (round 28): submits from onSubmit, so nothing typed is lost on an error or a match.
// A match (same email or LinkedIn URL) is shown first; "Add note and fill empty fields" sends the
// same details again naming that contact.

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import {
  CONTACT_FOCUS, CONTACT_FOCUS_LABELS, CONTACT_TYPE_LABELS, CONTACT_TYPES, INVESTOR_STAGE_LABELS, INVESTOR_STAGES, RELATIONSHIP_LABELS, RELATIONSHIPS,
} from "@/lib/contact-fields";
import { isPersonalSource } from "@/lib/contacts-import";
import { quickAddContact, type QuickAddMatch, type QuickAddResult } from "./actions";
import styles from "../../admin.module.css";

const VIA = { email: "same email", linkedin: "same LinkedIn URL", name: "same name and title, no email" } as const;

export default function QuickAdd({ defaultSource, sources }: { defaultSource: string; sources: string[] }) {
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<QuickAddResult | null>(null);
  const [match, setMatch] = useState<QuickAddMatch | null>(null);
  const [source, setSource] = useState(defaultSource);

  async function send(fill?: number) {
    const fd = new FormData(form.current!);
    if (fill) fd.set("fill", String(fill));
    setBusy(true);
    try {
      const r = await quickAddContact(fd);
      setRes(r);
      setMatch(!r.ok && r.match ? r.match : null);
      if (r.ok) { form.current!.reset(); setSource(defaultSource); }
    } catch {
      setRes({ ok: false, error: "That didn't save. Check that you're still signed in and try again." });
    } finally {
      setBusy(false);
    }
  }
  const onSubmit = (e: FormEvent) => { e.preventDefault(); send(); };
  const err = (k: string) => (res && !res.ok ? res.fieldErrors?.[k] : undefined);
  const field = (k: string) => ({ name: k, "aria-invalid": err(k) ? true : undefined, "aria-describedby": err(k) ? `qa-${k}-err` : undefined });
  const errorOf = (k: string) => (err(k) ? <span id={`qa-${k}-err`} className={styles.err}>{err(k)}</span> : null);

  return (
    <form ref={form} className={`${styles.panel} ${styles.edit}`} onSubmit={onSubmit} noValidate>
      {res?.ok && (
        <p role="status">
          <b>{res.created ? <>Added contact #{res.id}.</> : <>Updated contact #{res.id}{res.filled.length ? `: ${res.filled.join(", ")}` : ": nothing new to add"}.</>}</b>{" "}
          <Link href={`/admin/contacts?source=${encodeURIComponent(res.source)}`}>See {res.source}</Link> · add another below.
        </p>
      )}
      <label>Name<input {...field("name")} required maxLength={120} autoComplete="off" />{errorOf("name")}</label>
      <label><span>Email <span className={styles.note}>(optional)</span></span><input {...field("email")} type="email" inputMode="email" maxLength={254} autoComplete="off" />{errorOf("email")}</label>
      <label><span>LinkedIn URL <span className={styles.note}>(optional)</span></span><input {...field("linkedinUrl")} inputMode="url" maxLength={300} placeholder="linkedin.com/in/…" autoComplete="off" />{errorOf("linkedinUrl")}</label>
      <label>Company<input {...field("company")} maxLength={200} autoComplete="off" />{errorOf("company")}</label>
      <label>Title<input {...field("headline")} maxLength={500} autoComplete="off" />{errorOf("headline")}</label>
      <label>Contact type
        <select {...field("contactType")} defaultValue="">
          <option value="">Not set</option>
          {CONTACT_TYPES.map((t) => <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>)}
        </select>
      </label>
      <fieldset className={styles.checks}>
        <legend>Focus</legend>
        {CONTACT_FOCUS.map((f) => <label key={f} style={{ textTransform: "none" }}><input type="checkbox" name="focus" value={f} />{CONTACT_FOCUS_LABELS[f]}</label>)}
      </fieldset>
      <label>Stage
        <select {...field("stage")} defaultValue="">
          <option value="">Not set</option>
          {INVESTOR_STAGES.map((t) => <option key={t} value={t}>{INVESTOR_STAGE_LABELS[t]}</option>)}
        </select>
      </label>
      <fieldset className={styles.checks}>
        <legend>NYU alum</legend>
        {([["", "Unknown"], ["yes", "Yes"], ["no", "No"]] as const).map(([v, l]) => <label key={v}><input type="radio" name="nyuAlum" value={v} defaultChecked={v === ""} />{l}</label>)}
      </fieldset>
      <label>Relationship
        <select {...field("relationship")} defaultValue="cold">
          {RELATIONSHIPS.map((t) => <option key={t} value={t}>{RELATIONSHIP_LABELS[t]}</option>)}
        </select>
      </label>
      <label><span>First note <span className={styles.note}>(optional; saved as a dated line and sets the last touch)</span></span>
        <textarea {...field("note")} rows={3} maxLength={1000} style={{ font: "inherit", fontSize: 16, padding: 10, borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--fg)" }} />{errorOf("note")}
      </label>
      <label>Source
        <input {...field("source")} value={source} onChange={(e) => setSource(e.target.value.toLowerCase())} list="qa-sources" required pattern="[a-z0-9][a-z0-9\-]{0,39}" autoComplete="off" />
        <datalist id="qa-sources">{sources.map((s) => <option key={s} value={s} />)}</datalist>
        {errorOf("source")}
        {isPersonalSource(source) && <span className={styles.note}>A personal introduction: never in a bulk invite unless a super admin explicitly includes this source.</span>}
      </label>

      {match ? (
        <div className={styles.warn} role="alert">
          <p><b>Already a contact ({VIA[match.via]}):</b> #{match.id} · {match.name ?? "No name"}{match.email ? ` · ${match.email}` : ""}{match.company ? ` · ${match.company}` : ""}{match.headline ? ` · ${match.headline}` : ""}</p>
          <p className={styles.note}>{match.type ?? "No type"} · {match.relationship} · source {match.source}{match.linkedinUrl ? ` · ${match.linkedinUrl}` : ""}</p>
          <p className={styles.note}>Their filled fields stay as they are; empty ones are filled from this form, the note is added as a dated line, and the relationship only moves forward.</p>
          <p className={styles.row}>
            <button type="button" className={styles.primary} disabled={busy} onClick={() => send(match.id)}>{busy ? "Saving…" : "Add note and fill empty fields"}</button>
            <button type="button" disabled={busy} onClick={() => { setMatch(null); setRes(null); }}>Cancel</button>
          </p>
        </div>
      ) : (
        <p className={styles.row}><button type="submit" className={styles.primary} disabled={busy}>{busy ? "Checking…" : "Add contact"}</button></p>
      )}
      <p className={styles.err} role="alert">{res && !res.ok && !res.match && !Object.keys(res.fieldErrors ?? {}).length ? res.error : ""}</p>
    </form>
  );
}
