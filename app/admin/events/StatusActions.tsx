import type { EventStatus } from "@/lib/db/schema";
import { deleteEvent, setEventStatus } from "./actions";
import styles from "../admin.module.css";

export const STATUS_LABELS: Record<EventStatus, string> = { draft: "Draft", published: "Published", cancelled: "Cancelled" };

const MOVES: Record<EventStatus, { to: EventStatus; label: string }[]> = {
  draft: [{ to: "published", label: "Publish" }],
  published: [{ to: "cancelled", label: "Cancel event" }, { to: "draft", label: "Back to draft" }],
  cancelled: [{ to: "published", label: "Publish again" }],
};

/** Publish / cancel / back to draft (both roles) and delete (super admins only). */
export default function StatusActions({ id, status, canDelete, from }: { id: number; status: EventStatus; canDelete: boolean; from?: "edit" }) {
  return (
    <div className={styles.row}>
      {MOVES[status].map((m) => (
        <form key={m.to} action={setEventStatus}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="to" value={m.to} />
          <button type="submit" className={m.to === "published" ? styles.primary : undefined}>{m.label}</button>
        </form>
      ))}
      {canDelete && (
        <details className={styles.del}>
          <summary>Delete</summary>
          <form action={deleteEvent}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="confirm" value="yes" />
            {from && <input type="hidden" name="from" value={from} />}
            <button type="submit">Delete event {id} permanently</button>
          </form>
        </details>
      )}
    </div>
  );
}
