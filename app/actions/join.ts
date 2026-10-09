"use server";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { NOTIFY } from "@/content/events";
import { INDUSTRY_IDS } from "@/content/industries";
import { getDb } from "@/lib/db";
import { AFFILIATIONS } from "@/lib/db/schema";
import { rateLimited, sign, verify } from "@/lib/security";

const MIN_FILL_MS = 3000;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const EDIT_WINDOW_MS = 2 * 60 * 60 * 1000;
// Local (Codespaces) builds have no database; deployments always do.
const isLocal = !process.env.VERCEL;
const NO_DB = "DATABASE_URL isn't set, so nothing was saved. This message only appears outside Vercel.";
const GENERIC = "Something went wrong on our side. Please try again in a moment.";

export type JoinResult =
  | { ok: true; n: number | null; token: string | null; devNotice?: string }
  | { ok: false; error: string };

export type SaveResult = { ok: true; devNotice?: string } | { ok: false; error: string };

/** Issued when the flow opens; proves the form wasn't submitted instantly by a bot. */
export async function startJoin(): Promise<string> {
  return sign(`f.${Date.now()}`);
}

const joinSchema = z.object({
  formToken: z.string().max(200),
  website: z.string().max(200), // honeypot: real people never see it
  blocks: z.array(z.enum(INDUSTRY_IDS)).max(3),
  name: z.string().trim().min(1, "Add your name.").max(120),
  email: z.email("Enter an email we can reach you at, like name@example.com.").trim().max(254),
  // "friend" is kept for old rows only; the flow no longer offers it.
  affiliation: z.enum(AFFILIATIONS).exclude(["friend"]),
  notify: z.enum(NOTIFY).optional(),
  src: z.string().regex(/^[\w-]{1,40}$/).optional(),
});

export async function join(input: z.input<typeof joinSchema>): Promise<JoinResult> {
  const parsed = joinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const d = parsed.data;

  // Bots: fill the honeypot or submit too fast. Show the normal success screen and store nothing.
  const issued = Number(verify(d.formToken)?.split(".")[1]);
  const age = Date.now() - issued;
  if (!issued) return { ok: false, error: "This form expired. Please reload the page and try again." };
  if (d.website || age < MIN_FILL_MS) return { ok: true, n: null, token: null };
  if (age > MAX_FORM_AGE_MS) return { ok: false, error: "This form expired. Please reload the page and try again." };

  const db = getDb();
  if (!db) return isLocal ? { ok: true, n: 0, token: null, devNotice: NO_DB } : { ok: false, error: GENERIC };

  try {
    if (await rateLimited(db, "join", 8, 600)) return { ok: false, error: "Too many attempts. Please try again in a few minutes." };
    const blocks = [...new Set(d.blocks)];
    const notify = d.notify ? [d.notify] : [];
    // Re-submitting an email updates that row and keeps its original block number.
    // The response is identical either way, so it never reveals whether an email exists.
    const res = await db.execute<{ id: number; inserted: boolean }>(sql`
      insert into members (name, email, affiliation, blocks, notify, source)
      values (${d.name}, ${d.email}, ${d.affiliation}, ${pgArray(blocks)}::text[], ${pgArray(notify)}::text[], ${d.src ?? null})
      on conflict ((lower(email))) do update set
        name = excluded.name,
        affiliation = excluded.affiliation,
        blocks = case when cardinality(excluded.blocks) > 0 then excluded.blocks else members.blocks end,
        notify = array(select distinct unnest(members.notify || excluded.notify)),
        source = coalesce(members.source, excluded.source),
        updated_at = now()
      returning id, (xmax = 0) as inserted`);
    const row = res.rows[0];
    // The edit token lets this browser add optional details right away. For an existing
    // email it may only fill blanks, so typing someone else's email can't overwrite their profile.
    const token = sign(`m.${row.id}.${row.inserted ? 1 : 0}.${Date.now() + EDIT_WINDOW_MS}`);
    return { ok: true, n: row.id, token };
  } catch (e) {
    console.error("join failed", e instanceof Error ? e.message : e);
    return { ok: false, error: GENERIC };
  }
}

/**
 * Postgres array literal. Drizzle's sql`` would expand a JS array into a parameter list,
 * so pass it as one text param. Only used for validated enum values (no quoting needed).
 */
const pgArray = (values: string[]) => `{${values.join(",")}}`;

const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const linkedin = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
  .refine((v) => !v || /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/.+/i.test(v), "Use a linkedin.com profile URL.")
  .transform((v) => v || null);

const detailsSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("linkedin"), linkedinUrl: linkedin }),
  z.object({ kind: z.literal("work"), role: opt(120), company: opt(120) }),
  z.object({
    kind: z.literal("school"),
    school: opt(120),
    gradYear: z.union([z.literal(""), z.coerce.number().int().min(1940).max(new Date().getFullYear() + 8)])
      .transform((v) => (v === "" ? null : v)),
  }),
  z.object({ kind: z.literal("wall"), showOnWall: z.boolean(), wallName: opt(60) }),
]);

/** "Strengthen your block": each group saves on its own. */
export async function saveDetails(token: string, input: z.input<typeof detailsSchema>): Promise<SaveResult> {
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check this field and try again." };
  const d = parsed.data;
  if (d.kind === "wall" && d.showOnWall && !d.wallName) return { ok: false, error: "Add the name to show on the wall." };

  const db = getDb();
  if (!db) return isLocal ? { ok: true, devNotice: NO_DB } : { ok: false, error: GENERIC };

  const [kind, id, fresh, exp] = (verify(token) ?? "").split(".");
  if (kind !== "m" || !Number(id) || Date.now() > Number(exp)) {
    return { ok: false, error: "This link expired. Join again with the same email to add details." };
  }
  // New members can set anything; an existing email may only fill fields that are still empty.
  const set = (col: string, v: unknown) =>
    fresh === "1" ? sql`${sql.identifier(col)} = ${v}` : sql`${sql.identifier(col)} = coalesce(${sql.identifier(col)}, ${v})`;
  const updates =
    d.kind === "linkedin" ? [set("linkedin_url", d.linkedinUrl)]
    : d.kind === "work" ? [set("role", d.role), set("company", d.company)]
    : d.kind === "school" ? [set("school", d.school), sql`grad_year = ${fresh === "1" ? sql`${d.gradYear}` : sql`coalesce(grad_year, ${d.gradYear})`}`]
    : fresh === "1"
      // Any change to the wall entry needs fresh approval.
      ? [sql`show_on_wall = ${d.showOnWall}`, sql`wall_name = ${d.wallName}`, sql`wall_approved = false`]
      : [sql`show_on_wall = case when wall_name is null then ${d.showOnWall} else show_on_wall end`, set("wall_name", d.wallName)];

  try {
    if (await rateLimited(db, "details", 30, 600)) return { ok: false, error: "Too many attempts. Please try again in a few minutes." };
    await db.execute(sql`update members set ${sql.join(updates, sql`, `)}, updated_at = now() where id = ${Number(id)}`);
    return { ok: true };
  } catch (e) {
    console.error("saveDetails failed", e instanceof Error ? e.message : e);
    return { ok: false, error: GENERIC };
  }
}
