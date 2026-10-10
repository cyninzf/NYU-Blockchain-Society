"use client";

// Upload → map columns (with a masked preview) → confirm → summary. The file stays in this
// browser tab between steps and is sent again on confirm, so the server never keeps a copy.
// Takes a registrant export with emails (e.g. Luma) or the LinkedIn group export (no emails).

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { guessMapping, linkedinSource, MAX_IMPORT_BYTES, parseCheckIn, SOURCE_RE, type Mapping } from "@/lib/contacts-import";
import { importContacts, previewContacts, type ImportResult, type PreviewResult } from "../actions";
import styles from "../../admin.module.css";

type Preview = Extract<PreviewResult, { ok: true }>;
type Summary = Extract<ImportResult, { ok: true }>;

export default function ImportContacts() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [map, setMap] = useState<Mapping>({ name: -1, email: -1, headline: -1, checkIn: -1 });
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
    if (!file) return setErr("Choose a .csv or .xlsx file.");
    if (file.size > MAX_IMPORT_BYTES) return setErr("That file is over 4 MB. Export only the columns you need.");
    if (source && !SOURCE_RE.test(source)) return setErr("Use a short source label: lowercase letters, numbers and dashes, like luma-2024.");
    setBusy(true);
    try {
      const r = await previewContacts(body());
      if (!r.ok) return setErr(r.error);
      // Left empty: a LinkedIn export is labelled with this month (linkedin-2026-10); other lists need a label.
      if (!source) {
        if (r.format !== "linkedin") return setErr("Add a source label for this list, like luma-2024.");
        setSource(linkedinSource());
      }
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
    if (map.name < 0 && map.email < 0) return setErr("Pick the name column, the email column, or both.");
    setBusy(true);
    try {
      const r = await importContacts(body({ source, name: String(map.name), email: String(map.email), headline: String(map.headline), checkIn: String(map.checkIn) }));
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
          <div><dt>Skipped (no name or email)</dt><dd>{summary.skipped}</dd></div>
          <div><dt>Invalid emails skipped</dt><dd>{summary.invalid}</dd></div>
          <div><dt>Linked by email</dt><dd>{summary.linkedByEmail}</dd></div>
          <div><dt>Linked by name</dt><dd>{summary.linkedByName}</dd></div>
          <div><dt>Needs a look</dt><dd>{summary.needsLook}</dd></div>
        </dl>
        <p>Source: <code>{source}</code>. Every contact was matched against existing members{summary.needsLook ? <>; unclear name matches are under <Link href="/admin/contacts#review">Needs a look</Link></> : ""}. No emails were sent.</p>
        <p className={styles.row}><Link href={`/admin/contacts?source=${source}`}>See these contacts</Link><button type="button" onClick={reset}>Import another file</button></p>
      </section>
    );
  }

  if (preview) {
    const cols = [
      { k: "name", label: "Name column" }, { k: "email", label: "Email column" },
      { k: "headline", label: "Headline column (optional)" }, { k: "checkIn", label: "Check-in column (optional)" },
    ] as const;
    const cell = (r: string[], i: number) => (i >= 0 ? r[i] ?? "" : "");
    return (
      <section className={styles.panel} aria-labelledby="imp-map">
        <h2 id="imp-map">Map columns</h2>
        <p>{file?.name}: {preview.rows} rows{preview.format === "linkedin" ? " (LinkedIn group export: name and headline only)" : ""}. Source <code>{source}</code>. Nothing is saved until you confirm.</p>
        <div className={styles.filters}>
          {cols.map(({ k, label }) => (
            <label key={k}>{label}
              <select value={map[k]} onChange={(e) => setMap({ ...map, [k]: Number(e.target.value) })}>
                <option value={-1}>None</option>
                {preview.headers.map((h, i) => !preview.ignored[i] && <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
              </select>
            </label>
          ))}
        </div>
        <h3>Preview: first {preview.sample.length} rows</h3>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead><tr><th scope="col">Name</th><th scope="col">Email (masked)</th><th scope="col">Headline</th><th scope="col">Checked in</th></tr></thead>
            <tbody>
              {preview.sample.map((r, i) => (
                <tr key={i}>
                  <td>{cell(r, map.name)}</td>
                  <td>{cell(r, map.email)}</td>
                  <td>{cell(r, map.headline)}</td>
                  <td>{map.checkIn < 0 ? "Unknown" : parseCheckIn(cell(r, map.checkIn)) ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.note}>Rows with an email dedupe on it; rows without one on name + headline. Invalid emails and rows with neither a name nor an email are skipped. Existing contacts and members are never overwritten; after the import, contacts are linked to members by email or a clear name match.{preview.ignored.some(Boolean) ? " Group role and Open to work are never read or stored." : ""}</p>
        <p className={styles.row}>
          <button type="button" className={styles.primary} onClick={onImport} disabled={busy || (map.name < 0 && map.email < 0)}>{busy ? "Importing…" : `Import ${preview.rows} rows`}</button>
          <button type="button" onClick={reset} disabled={busy}>Cancel</button>
        </p>
        <p className={styles.err} role="alert">{err}</p>
      </section>
    );
  }

  return (
    <form className={styles.panel} onSubmit={onPreview}>
      <p>Upload a .csv or .xlsx: a registrant export with emails (e.g. Luma), or the LinkedIn group member export as downloaded (Name, Title / Headline, Group role; only name and headline are kept). It&apos;s read in memory to import rows, never stored as a file. Contacts are not members and get no email from this step.</p>
      <div className={styles.filters}>
        <label>File
          <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label>Source label
          <input value={source} onChange={(e) => setSource(e.target.value.toLowerCase())} placeholder="luma-2024 (LinkedIn: this month if empty)" pattern="[a-z0-9][a-z0-9\-]{0,39}" />
        </label>
        <button type="submit" disabled={busy}>{busy ? "Reading…" : "Preview"}</button>
      </div>
      <p className={styles.err} role="alert">{err}</p>
    </form>
  );
}
