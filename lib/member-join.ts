import "server-only";
import { sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import type { Db } from "./db";
import type { Affiliation } from "./db/schema";
import { autoLinkQuietly } from "./contact-links";
import { sendWelcome } from "./member-email";

import { reportError } from "./monitoring";
export type NewMember = { name: string; email: string; affiliation: Affiliation; blocks: string[]; notify: string[]; src: string | null };

/**
 * Postgres array literal. Drizzle's sql`` would expand a JS array into a parameter list,
 * so pass it as one text param. Only used for validated enum values (no quoting needed).
 */
const pgArray = (values: string[]) => `{${values.join(",")}}`;

/**
 * Adds a member, or updates the row for an existing email (keeping its block number, its first
 * source and its blocks unless new ones were picked). Shared by the join flow and event
 * check-in. `inserted` says which happened; callers must never reveal it to the visitor.
 * A new block refreshes the public aggregates and gets the one welcome email after the response.
 */
export async function upsertMember(db: Db, d: NewMember, welcomeNotify: string | null): Promise<{ id: number; inserted: boolean }> {
  const res = await db.execute<{ id: number; inserted: boolean }>(sql`
    insert into members (name, email, affiliation, blocks, notify, source)
    values (${d.name}, ${d.email}, ${d.affiliation}, ${pgArray(d.blocks)}::text[], ${pgArray(d.notify)}::text[], ${d.src})
    on conflict ((lower(email))) do update set
      name = excluded.name,
      affiliation = excluded.affiliation,
      blocks = case when cardinality(excluded.blocks) > 0 then excluded.blocks else members.blocks end,
      notify = array(select distinct unnest(members.notify || excluded.notify)),
      source = coalesce(members.source, excluded.source),
      updated_at = now()
    returning id, (xmax = 0) as inserted`);
  const row = { id: Number(res.rows[0].id), inserted: Boolean(res.rows[0].inserted) };
  if (row.inserted) {
    // Re-submits update a row (inserted = false): no email, so nothing reveals an existing email.
    revalidateTag("chain", "max");
    after(() => sendWelcome(db, row.id, welcomeNotify).catch((e) => reportError("join", "welcome failed", e)));
  }
  // Someone we already knew as a contact may have joined: link by email or a clear name match.
  after(() => autoLinkQuietly(db));
  return row;
}
