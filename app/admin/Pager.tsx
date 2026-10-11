import Link from "next/link";
import { PAGE_SIZE } from "@/lib/paging";
import styles from "./admin.module.css";

/** "Showing 101–200 of 314" with Previous / Next, keeping the current search and filters (`qs`). */
export default function Pager({ path, qs, page, last, total, shown, label }: { path: string; qs: string; page: number; last: number; total: number; shown: number; label: string }) {
  if (!total) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(qs);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return `${path}${s ? `?${s}` : ""}`;
  };
  const from = (page - 1) * PAGE_SIZE + 1;
  return (
    <nav className={styles.pager} aria-label={`${label} pages`}>
      <p role="status">Showing {from.toLocaleString("en-US")}–{(from + shown - 1).toLocaleString("en-US")} of {total.toLocaleString("en-US")}</p>
      {last > 1 && (
        <p>
          {page > 1 ? <Link href={href(page - 1)} rel="prev">Previous</Link> : <span aria-disabled="true">Previous</span>}
          <span>Page {page} of {last}</span>
          {page < last ? <Link href={href(page + 1)} rel="next">Next</Link> : <span aria-disabled="true">Next</span>}
        </p>
      )}
    </nav>
  );
}
