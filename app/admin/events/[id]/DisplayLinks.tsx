import { desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { displayLinks } from "@/lib/db/schema";
import { revokeDisplayLink } from "../actions";
import DisplayLinkForm from "./DisplayLinkForm";
import styles from "../../admin.module.css";

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });

/** Super admins, published events: create and revoke display links for the live screen. */
export default async function DisplayLinks({ db, eventId, slug }: { db: Db; eventId: number; slug: string }) {
  const links = await db.select().from(displayLinks).where(eq(displayLinks.eventId, eventId)).orderBy(desc(displayLinks.id));
  return (
    <section className={styles.mix} aria-labelledby="dl-h">
      <h2 id="dl-h">Live screen <span>Signed in as a super admin, open <a href={`/events/${slug}/live`} target="_blank" rel="noopener">/events/{slug}/live</a>. For a TV that shouldn&apos;t sign in, create a display link: it works without signing in, only for this live screen, only from 3 hours before the start until 2 hours after the end, and until revoked. It never signs anyone in.</span></h2>
      <DisplayLinkForm id={eventId} />
      {links.length > 0 && (
        <ul className={styles.edit}>
          {links.map((l) => (
            <li key={l.id} className={styles.row}>
              <span>Link #{l.id} · created {dateFmt.format(l.createdAt)} by {l.createdBy}</span>
              {l.revokedAt ? <span className={styles.badge}>Revoked {dateFmt.format(l.revokedAt)}</span> : (
                <form action={revokeDisplayLink}>
                  <input type="hidden" name="id" value={eventId} />
                  <input type="hidden" name="linkId" value={l.id} />
                  <button type="submit">Revoke</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
