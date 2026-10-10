import type { SpamReason } from "@/lib/db/schema";
import styles from "./admin.module.css";

// Suspected spam in the admin (round 20): the badge, the filter and the "Not spam" button, shared
// by the three Inquiries tabs and the pending joins on Members.

const REASON: Record<SpamReason, string> = { honeypot: "hidden field filled", too_fast: "sent too fast" };

/** ?spam=1 only suspected spam, ?spam=0 none of it; anything else, everything. */
export const spamFilterOf = (v: unknown): boolean | undefined => (v === "1" ? true : v === "0" ? false : undefined);

export function SpamFilter({ value }: { value: boolean | undefined }) {
  return (
    <label>Spam
      <select name="spam" defaultValue={value === undefined ? "" : value ? "1" : "0"}>
        <option value="">Any</option>
        <option value="1">Suspected spam</option>
        <option value="0">Not spam</option>
      </select>
    </label>
  );
}

export function SpamBadge({ reason }: { reason: string | null }) {
  return <span className={`${styles.badge} ${styles.spam}`}>Suspected spam{reason && reason in REASON ? ` · ${REASON[reason as SpamReason]}` : ""}</span>;
}

/** Super admins only: back to normal, sending what was skipped. */
export function NotSpamButton({ action, id, what }: { action: (fd: FormData) => Promise<void>; id: number; what: string }) {
  return (
    <form action={action} className={styles.row}>
      <input type="hidden" name="id" value={id} />
      <button type="submit">Not spam<span className="sr"> ({what} #{id})</span></button>
    </form>
  );
}
