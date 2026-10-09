"use client";

// Upload → preview (the three kept columns, first 5 rows) → confirm → summary. The file stays
// in this browser tab between steps and is sent again on confirm, so the server never keeps a copy.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ROSTER_MAX_BYTES } from "@/lib/linkedin-import";
import { SOURCE_RE } from "@/lib/contacts-import";
import { importRoster, previewRoster, type RosterImport, type RosterPreview } from "../actions";
import styles from "../../admin.module.css";

type Preview = Extract<RosterPreview, { ok: true }>;
type Summary = Extract<RosterImport, { ok: true }>;
const ROLE = { owner: "Owner", manager: "Manager" } as const;

export default function ImportRoster() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
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
    if (!file) return setErr("Choose the group export (.xlsx or .csv).");
    if (file.size > ROSTER_MAX_BYTES) return setErr("That file is over 4 MB.");
    // left empty: label it with this month, e.g. linkedin-group-2026-10
    const label = source || `linkedin-group-${new Date().toISOString().slice(0, 7)}`;
    setSource(label);
    if (!SOURCE_RE.test(label)) return setErr("Use a short source label: lowercase letters, numbers and dashes, like linkedin-group-2026-10.");
    setBusy(true);
    try {
      const r = await previewRoster(body());
      if (!r.ok) return setErr(r.error);
      setPreview(r);
    } catch {
      setErr("Couldn't read that file. Check that you're still signed in and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    setErr("");
    setBusy(true);
    try {
      const r = await importRoster(body({ source }));
      if (!r.ok) return setErr(r.error);
      setSummary(r);
    } catch {
      setErr("The import failed. Check that you're still signed in and try again.");
    } finally {
      setBusy(false);
    }
  }

  const reset = () => { setFile(null); setPreview(null); setSummary(null); setErr(""); };

  if (summary) {
    return (
      <section className={styles.panel} aria-labelledby="imp-done">
        <h2 id="imp-done">Import finished</h2>
        <dl className={styles.counts}>
          <div><dt>Rows in file</dt><dd>{summary.total}</dd></div>
          <div><dt>Imported</dt><dd>{summary.imported}</dd></div>
          <div><dt>Duplicates (already on the roster)</dt><dd>{summary.duplicates}</dd></div>
          <div><dt>Skipped (no name)</dt><dd>{summary.skipped}</dd></div>
        </dl>
        <p>Source: <code>{source}</code>. Existing rows were left as they were.</p>
        <p className={styles.row}><Link href="/admin/linkedin">See the roster</Link><button type="button" onClick={reset}>Import another file</button></p>
      </section>
    );
  }

  if (preview) {
    return (
      <section className={styles.panel} aria-labelledby="imp-prev">
        <h2 id="imp-prev">Check before importing</h2>
        <p>{file?.name}: {preview.rows} rows. Source <code>{source}</code>. Only Name, Title / Headline and Group role are kept{preview.ignored ? `; ${preview.ignored} other column${preview.ignored === 1 ? " is" : "s are"} ignored` : ""}. Nothing is saved until you confirm.</p>
        <h3>First {preview.sample.length} rows</h3>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead><tr><th scope="col">Name</th><th scope="col">Headline</th><th scope="col">Group role</th></tr></thead>
            <tbody>
              {preview.sample.map((r, i) => (
                <tr key={i}><td>{r.name || <em>(no name: skipped)</em>}</td><td>{r.headline}</td><td>{r.role ? ROLE[r.role] : "Member"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.primary} onClick={onImport} disabled={busy}>{busy ? "Importing…" : `Import ${preview.rows} rows`}</button>
          <button type="button" onClick={reset} disabled={busy}>Start over</button>
        </div>
        <p className={styles.err} role="alert">{err}</p>
      </section>
    );
  }

  return (
    <form className={styles.panel} onSubmit={onPreview}>
      <p className={styles.lede}>Upload the member export from the LinkedIn group (.xlsx, or saved as .csv). It&apos;s read in memory on the server and never stored as a file. Expected columns: Name, Title / Headline, Group role (&quot;Owner (You)&quot; counts as owner). Every other column, including &quot;Open to work&quot;, is ignored. Re-importing a newer export adds new people and leaves existing rows untouched.</p>
      <label>Group export
        <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <label>Source label
        <input value={source} onChange={(e) => setSource(e.target.value.toLowerCase())} pattern="[a-z0-9][a-z0-9-]{0,39}" placeholder="linkedin-group-YYYY-MM (this month if left empty)" />
      </label>
      <div className={styles.row}>
        <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Reading…" : "Preview"}</button>
      </div>
      <p className={styles.err} role="alert">{err}</p>
    </form>
  );
}
