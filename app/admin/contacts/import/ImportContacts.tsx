"use client";

// Upload → map columns (with a masked preview) → confirm → summary. The file stays in this
// browser tab between steps and is sent again on confirm, so the server never keeps a copy.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { guessMapping, MAX_IMPORT_BYTES, parseCheckIn, SOURCE_RE, type Mapping } from "@/lib/contacts-import";
import { importContacts, previewContacts, type ImportResult, type PreviewResult } from "../actions";
import styles from "../../admin.module.css";

type Preview = Extract<PreviewResult, { ok: true }>;
type Summary = Extract<ImportResult, { ok: true }>;

export default function ImportContacts() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [map, setMap] = useState<Mapping>({ name: -1, email: -1, checkIn: -1 });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const body = (extra: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("file", file!);
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    return fd;
  };

  async function onPreview(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (!file) return setErr("Choose a CSV file.");
    if (file.size > MAX_IMPORT_BYTES) return setErr("That file is over 4 MB. Export only the columns you need.");
    if (!SOURCE_RE.test(source)) return setErr("Use a short source label: lowercase letters, numbers and dashes, like conference-2024.");
    setBusy(true);
    try {
      const r = await previewContacts(body());
      if (!r.ok) return setErr(r.error);
      setPreview(r);
      setMap(guessMapping(r.headers));
    } catch {
      setErr("Couldn't read that file. Check that you're still signed in and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    setErr("");
    if (map.email < 0) return setErr("Pick the column that holds email addresses.");
    setBusy(true);
    try {
      const r = await importContacts(body({ source, name: String(map.name), email: String(map.email), checkIn: String(map.checkIn) }));
      if (!r.ok) return setErr(r.error);
      setSummary(r);
    } catch {
      setErr("The import failed. Check that you're still signed in and try again.");
    } finally {
      setBusy(false);
    }
  }

  const reset = () => { setFile(null); setPreview(null); setSummary(null); setSource(""); setErr(""); };

  if (summary) {
    return (
      <section className={styles.panel} aria-labelledby="imp-done">
        <h2 id="imp-done">Import finished</h2>
        <dl className={styles.counts}>
          <div><dt>Rows in file</dt><dd>{summary.total}</dd></div>
          <div><dt>Imported</dt><dd>{summary.imported}</dd></div>
          <div><dt>Duplicates skipped</dt><dd>{summary.duplicates}</dd></div>
          <div><dt>Invalid emails skipped</dt><dd>{summary.invalid}</dd></div>
          <div><dt>Already members</dt><dd>{summary.alreadyMembers}</dd></div>
        </dl>
        <p>Source: <code>{source}</code>. No emails were sent.</p>
        <p className={styles.row}><Link href={`/admin/contacts?source=${source}`}>See these contacts</Link><button type="button" onClick={reset}>Import another file</button></p>
      </section>
    );
  }

  if (preview) {
    const cols = [{ k: "name", label: "Name column" }, { k: "email", label: "Email column" }, { k: "checkIn", label: "Check-in column (optional)" }] as const;
    const cell = (r: string[], i: number) => (i >= 0 ? r[i] ?? "" : "");
    return (
      <section className={styles.panel} aria-labelledby="imp-map">
        <h2 id="imp-map">Map columns</h2>
        <p>{file?.name}: {preview.rows} rows. Source <code>{source}</code>. Nothing is saved until you confirm.</p>
        <div className={styles.filters}>
          {cols.map(({ k, label }) => (
            <label key={k}>{label}
              <select value={map[k]} onChange={(e) => setMap({ ...map, [k]: Number(e.target.value) })}>
                <option value={-1}>{k === "email" ? "Choose…" : "None"}</option>
                {preview.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
              </select>
            </label>
          ))}
        </div>
        <h3>Preview: first {preview.sample.length} rows</h3>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead><tr><th scope="col">Name</th><th scope="col">Email (masked)</th><th scope="col">Checked in</th></tr></thead>
            <tbody>
              {preview.sample.map((r, i) => (
                <tr key={i}>
                  <td>{cell(r, map.name)}</td>
                  <td>{cell(r, map.email)}</td>
                  <td>{map.checkIn < 0 ? "Unknown" : parseCheckIn(cell(r, map.checkIn)) ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.note}>Invalid emails are skipped. Emails already in contacts or members are skipped and never overwritten.</p>
        <p className={styles.row}>
          <button type="button" className={styles.primary} onClick={onImport} disabled={busy || map.email < 0}>{busy ? "Importing…" : `Import ${preview.rows} rows`}</button>
          <button type="button" onClick={reset} disabled={busy}>Cancel</button>
        </p>
        <p className={styles.err} role="alert">{err}</p>
      </section>
    );
  }

  return (
    <form className={styles.panel} onSubmit={onPreview}>
      <p>Upload a CSV, for example a Luma registrant export. It&apos;s read in memory to import rows, never stored as a file. Contacts are not members and get no email from this step.</p>
      <div className={styles.filters}>
        <label>CSV file
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label>Source label
          <input value={source} onChange={(e) => setSource(e.target.value.toLowerCase())} placeholder="conference-2024" pattern="[a-z0-9][a-z0-9\-]{0,39}" />
        </label>
        <button type="submit" disabled={busy}>{busy ? "Reading…" : "Preview"}</button>
      </div>
      <p className={styles.err} role="alert">{err}</p>
    </form>
  );
}
