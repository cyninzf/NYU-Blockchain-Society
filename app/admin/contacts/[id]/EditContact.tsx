"use client";

// Submits from onSubmit, so nothing typed is lost on an error. The note field clears after a save.

import { useRef, useState, type FormEvent } from "react";
import {
  CONTACT_FOCUS, CONTACT_FOCUS_LABELS, CONTACT_TYPE_LABELS, CONTACT_TYPES, INVESTOR_STAGE_LABELS, INVESTOR_STAGES, RELATIONSHIP_LABELS, RELATIONSHIPS,
  type ContactType, type InvestorStage, type Relationship,
} from "@/lib/contact-fields";
import { saveContactEdit, type EditResult } from "./actions";
import styles from "../../admin.module.css";

type C = {
  id: number; company: string | null; headline: string | null; linkedinUrl: string | null; contactType: ContactType | null; focus: string[];
  stage: InvestorStage | null; nyuAlum: boolean | null; relationship: Relationship; notes: string | null; lastTouchAt: string | null;
};

export default function EditContact({ c }: { c: C }) {
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<EditResult | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await saveContactEdit(new FormData(form.current!));
      setRes(r);
      if (r.ok) (form.current!.elements.namedItem("note") as HTMLTextAreaElement).value = "";
    } catch {
      setRes({ ok: false, error: "That didn't save. Check that you're still signed in and try again." });
    } finally {
      setBusy(false);
    }
  }
  const err = (k: string) => (res && !res.ok ? res.fieldErrors?.[k] : undefined);
  const field = (k: string) => ({ name: k, "aria-invalid": err(k) ? true : undefined, "aria-describedby": err(k) ? `ec-${k}-err` : undefined });
  const errorOf = (k: string) => (err(k) ? <span id={`ec-${k}-err`} className={styles.err}>{err(k)}</span> : null);

  return (
    <form ref={form} className={`${styles.panel} ${styles.edit}`} onSubmit={onSubmit} noValidate>
      <input type="hidden" name="id" value={c.id} />
      <label>Company<input {...field("company")} defaultValue={c.company ?? ""} maxLength={200} autoComplete="off" />{errorOf("company")}</label>
      <label>Title<input {...field("headline")} defaultValue={c.headline ?? ""} maxLength={500} autoComplete="off" />{errorOf("headline")}</label>
      <label><span>LinkedIn URL <span className={styles.note}>(optional)</span></span><input {...field("linkedinUrl")} defaultValue={c.linkedinUrl ?? ""} inputMode="url" maxLength={300} placeholder="linkedin.com/in/…" autoComplete="off" />{errorOf("linkedinUrl")}</label>
      <label>Contact type
        <select {...field("contactType")} defaultValue={c.contactType ?? ""}>
          <option value="">Not set</option>
          {CONTACT_TYPES.map((t) => <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>)}
        </select>
      </label>
      <fieldset className={styles.checks}>
        <legend>Focus</legend>
        {CONTACT_FOCUS.map((f) => <label key={f} style={{ textTransform: "none" }}><input type="checkbox" name="focus" value={f} defaultChecked={c.focus.includes(f)} />{CONTACT_FOCUS_LABELS[f]}</label>)}
      </fieldset>
      <label>Stage
        <select {...field("stage")} defaultValue={c.stage ?? ""}>
          <option value="">Not set</option>
          {INVESTOR_STAGES.map((t) => <option key={t} value={t}>{INVESTOR_STAGE_LABELS[t]}</option>)}
        </select>
      </label>
      <fieldset className={styles.checks}>
        <legend>NYU alum</legend>
        {([["", "Unknown", null], ["yes", "Yes", true], ["no", "No", false]] as const).map(([v, l, b]) => <label key={v}><input type="radio" name="nyuAlum" value={v} defaultChecked={c.nyuAlum === b} />{l}</label>)}
      </fieldset>
      <label>Relationship
        <select {...field("relationship")} defaultValue={c.relationship}>
          {RELATIONSHIPS.map((t) => <option key={t} value={t}>{RELATIONSHIP_LABELS[t]}</option>)}
        </select>
      </label>
      <div>
        <p className={styles.note}>Notes{c.lastTouchAt ? ` · last touch ${c.lastTouchAt}` : ""}</p>
        <p className={styles.notes}>{c.notes || "No notes yet."}</p>
      </div>
      <label><span>Add a note <span className={styles.note}>(optional; saved as a dated line)</span></span>
        <textarea {...field("note")} rows={3} maxLength={1000} style={{ font: "inherit", fontSize: 16, padding: 10, borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--fg)" }} />{errorOf("note")}
      </label>
      <p className={styles.row}><button type="submit" className={styles.primary} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></p>
      <p className={res?.ok === false ? styles.err : styles.note} role="status">
        {res ? (res.ok ? (res.changed.length ? `Saved: ${res.changed.join(", ")}.` : "Nothing changed.") : Object.keys(res.fieldErrors ?? {}).length ? "" : res.error) : ""}
      </p>
    </form>
  );
}
