"use client";

// Upload → dry run (counts, each row's source, skipped rows with reasons; re-run whenever the
// mapping or label changes) → confirm → summary. The file stays in this browser tab between steps
// and is sent again each time, so the server never keeps a copy.
// Takes a registrant export with emails (e.g. Luma), any list with name, email, company, title,
// source and notes columns (plus, round 28, LinkedIn URL, type, focus, stage, NYU alum and
// relationship), or the LinkedIn group export (no emails).

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { MAPPING_KEYS, MAX_IMPORT_BYTES, SOURCE_RE, type Mapping, type PlanRow } from "@/lib/contacts-import";
import { importContacts, previewContacts, type ImportResult, type PreviewResult } from "../actions";
import styles from "../../admin.module.css";

type Preview = Extract<PreviewResult, { ok: true }>;
type Summary = Extract<ImportResult, { ok: true }>;

const COLS: { k: keyof Mapping; label: string }[] = [
  { k: "name", label: "Name column" }, { k: "email", label: "Email column" },
  { k: "headline", label: "Title / headline column (optional)" }, { k: "company", label: "Company column (optional)" },
  { k: "source", label: "Source column (optional)" }, { k: "notes", label: "Notes column (optional)" },
  { k: "checkIn", label: "Check-in column (optional)" },
  { k: "linkedin", label: "LinkedIn URL column (optional)" }, { k: "contactType", label: "Type column (optional)" },
  { k: "focus", label: "Focus column (optional)" }, { k: "stage", label: "Stage column (optional)" },
  { k: "nyuAlum", label: "NYU alum column (optional)" }, { k: "relationship", label: "Relationship column (optional)" },
];
const ACTION = { new: "New", match: "Matched", skip: "Skipped" } as const;

export default function ImportContacts() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const body = (map: Mapping | null, label: string) => {
    const fd = new FormData();
    fd.set("file", file!);
    fd.set("source", label);
    if (map) {
      fd.set("mapped", "1");
      for (const k of MAPPING_KEYS) fd.set(k, String(map[k]));
    }
    return fd;
  };

  /** The dry run: first with the guessed mapping, then with whatever the admin picked. */
  async function runPreview(map: Mapping | null, label: string) {
    setErr("");
    if (label && !SOURCE_RE.test(label)) return setErr("Use a short source label: lowercase letters, numbers and dashes, like luma-2024.");
    setBusy(true);
    try {
      const r = await previewContacts(body(map, label));
      if (!r.ok) return setErr(r.error);
      setPreview(r);
      setSource(r.label);
    } catch {
      setErr("Couldn't read that file. Check that you're still signed in and try again.");
    } finally {
      setBusy(false);
    }
  }

  function onPreview(e: FormEvent) {
    e.preventDefault();
    if (!file) return setErr("Choose a .csv or .xlsx file.");
    if (file.size > MAX_IMPORT_BYTES) return setErr("That file is over 4 MB. Export only the columns you need.");
    runPreview(null, source);
  }

  async function onImport() {
    if (!preview) return;
    setErr("");
    setBusy(true);
    try {
      const r = await importContacts(body(preview.mapping, preview.label));
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
    const one = Object.keys(summary.bySource);
    return (
      <section className={styles.panel} aria-labelledby="imp-done">
        <h2 id="imp-done">Import finished</h2>
        <dl className={styles.counts}>
          <div><dt>Rows in file</dt><dd>{summary.total}</dd></div>
          <div><dt>New contacts</dt><dd>{summary.created}</dd></div>
          <div><dt>Matched existing</dt><dd>{summary.matched}</dd></div>
          <div><dt>Matched and updated</dt><dd>{summary.updated}</dd></div>
          <div><dt>Skipped</dt><dd>{summary.skipped}</dd></div>
          <div><dt>Linked by email</dt><dd>{summary.linkedByEmail}</dd></div>
          <div><dt>Linked by name</dt><dd>{summary.linkedByName}</dd></div>
          <div><dt>Needs a look</dt><dd>{summary.needsLook}</dd></div>
        </dl>
        <p>Every contact was matched against existing members{summary.needsLook ? <>; unclear name matches are under <Link href="/admin/contacts#review">Needs a look</Link></> : ""}. No members were created and no emails were sent.</p>
        <p className={styles.row}>
          {one.map((s) => <Link key={s} href={`/admin/contacts?source=${s}`}>See {s}</Link>)}
          <button type="button" onClick={reset}>Import another file</button>
        </p>
      </section>
    );
  }

  if (preview) {
    const { counts } = preview;
    // The import runs exactly what was previewed: a changed label needs Update preview first.
    const stale = source !== preview.label;
    const blocked = preview.missingSource > 0 || stale;
    return (
      <section className={styles.panel} aria-labelledby="imp-map">
        <h2 id="imp-map">Check the import</h2>
        <p>{file?.name}: {counts.total} rows{preview.format === "linkedin" ? " (LinkedIn group export: name and headline only)" : ""}. Nothing is saved until you confirm.</p>
        <div className={styles.filters}>
          {COLS.map(({ k, label }) => (
            <label key={k}>{label}
              <select value={preview.mapping[k]} disabled={busy} onChange={(e) => runPreview({ ...preview.mapping, [k]: Number(e.target.value) }, source)}>
                <option value={-1}>None</option>
                {preview.headers.map((h, i) => !preview.ignored[i] && <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
              </select>
            </label>
          ))}
          <label>Source label (rows without their own)
            <input value={source} onChange={(e) => setSource(e.target.value.toLowerCase())} placeholder="luma-2024" pattern="[a-z0-9][a-z0-9\-]{0,39}" />
          </label>
          <button type="button" onClick={() => runPreview(preview.mapping, source)} disabled={busy}>{busy ? "Checking…" : "Update preview"}</button>
        </div>

        <dl className={styles.counts}>
          <div><dt>New contacts</dt><dd>{counts.created}</dd></div>
          <div><dt>Matched existing</dt><dd>{counts.matched}</dd></div>
          <div><dt>Matched, will be updated</dt><dd>{counts.updated}</dd></div>
          <div><dt>Skipped</dt><dd>{counts.skipped}</dd></div>
        </dl>
        {stale && <p className={styles.err}>The source label changed: press Update preview to check the import again.</p>}
        {preview.missingSource > 0 && <p className={styles.err}>{preview.missingSource} {preview.missingSource === 1 ? "row has" : "rows have"} no source of their own. Add a source label above and press Update preview.</p>}

        <h3>By source</h3>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead><tr><th scope="col">Source</th><th scope="col">Rows (new and matched)</th></tr></thead>
            <tbody>
              {Object.entries(counts.bySource).map(([s, n]) => <tr key={s}><td>{s ? <code>{s}</code> : "None (add a label)"}</td><td>{n}</td></tr>)}
            </tbody>
          </table>
        </div>

        <h3>First {preview.sample.length} rows</h3>
        <Rows rows={preview.sample} />

        {preview.skippedRows.length > 0 && <>
          <h3>Skipped rows ({counts.skipped})</h3>
          <Rows rows={preview.skippedRows} />
          {counts.skipped > preview.skippedRows.length && <p className={styles.note}>The first {preview.skippedRows.length} are shown.</p>}
        </>}

        <p className={styles.note}>Rows match existing contacts by email (case-insensitive, trimmed){preview.format === "linkedin" ? "; rows without one by name + headline" : ""}. A match only fills empty fields (a relationship only moves forward, e.g. Cold to Replied, never back); it keeps its original source, and a different source is added to its notes as &ldquo;Also from …&rdquo;. Notes are added as dated lines, never replacing earlier ones, and set the contact&apos;s last touch. Type, focus, stage, NYU alum and relationship values that aren&apos;t recognised are left empty. A row&apos;s own source becomes a label like via-alex. Contacts only: no members are created and no emails are sent; after the import, contacts are linked to members by email or a clear name match.{preview.ignored.some(Boolean) ? " Group role and Open to work are never read or stored." : ""}</p>
        <p className={styles.row}>
          <button type="button" className={styles.primary} onClick={onImport} disabled={busy || blocked || counts.created + counts.matched === 0}>
            {busy ? "Working…" : `Import: ${counts.created} new, ${counts.matched} matched`}
          </button>
          <button type="button" onClick={reset} disabled={busy}>Cancel</button>
        </p>
        <p className={styles.err} role="alert">{err}</p>
      </section>
    );
  }

  return (
    <form className={styles.panel} onSubmit={onPreview}>
      <p>Upload a .csv or .xlsx: a list with columns like name, email, company, title, source and notes, and optionally LinkedIn URL, type, focus, stage, NYU alum and relationship (other columns are ignored), a registrant export with emails (e.g. Luma), or the LinkedIn group member export as downloaded (Name, Title / Headline, Group role; only name and headline are kept). It&apos;s read in memory, never stored as a file. Contacts are not members and get no email from this step.</p>
      <div className={styles.filters}>
        <label>File
          <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label>Source label
          <input value={source} onChange={(e) => setSource(e.target.value.toLowerCase())} placeholder="luma-2024 (optional if rows have a source)" pattern="[a-z0-9][a-z0-9\-]{0,39}" />
        </label>
        <button type="submit" disabled={busy}>{busy ? "Reading…" : "Preview"}</button>
      </div>
      <p className={styles.err} role="alert">{err}</p>
    </form>
  );
}

function Rows({ rows }: { rows: PlanRow[] }) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead><tr><th scope="col">Row (under the header)</th><th scope="col">Name</th><th scope="col">Email (masked)</th><th scope="col">Title / headline</th><th scope="col">Company</th><th scope="col">Source</th><th scope="col">Result</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.line}>
              <td>{r.line}</td>
              <td>{r.name}</td>
              <td>{r.email || "—"}</td>
              <td>{r.headline}</td>
              <td>{r.company}</td>
              <td>{r.source ? <code>{r.source}</code> : "None"}</td>
              <td>{r.action === "skip" ? <>Skipped: {r.reason}</> : ACTION[r.action]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
