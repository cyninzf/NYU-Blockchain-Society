import "server-only";
import { and, arrayContains, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { AFFILIATION_LABELS, FOCUS, FOCUS_LABELS, HELP_LABELS, STAGE_LABELS } from "@/content/accelerator";
import { auditRow } from "./admin";
import type { Db } from "./db";
import { acceleratorInterest, adminAudit, FOUNDER_AFFILIATIONS, FOUNDER_STAGES, INTEREST_STATUSES, INTEREST_TYPES, SUPPORT_KINDS, type InterestStatus, type InterestType, type SpamReason } from "./db/schema";
import { renderEmail, sendEmail } from "./email";
import { upsertMember, type NewMember } from "./member-join";
import { optText } from "./member-fields";

// Accelerator interest from /accelerator (round 14), the round 13 inquiry pattern: stored, then
// one notification to SUPER_ADMIN_EMAIL with reply-to set to the submitter, who gets no email.
// A founder who ticks "Also add me as a member" also joins (notify accelerator, src accelerator-founder).

export const FOUNDER_SOURCE = "accelerator-founder";

const name = z.string().trim().min(1, "Add your name.").max(120, "Keep the name under 120 characters.");
const email = z.email("Enter an email we can reply to, like name@example.com.").trim().max(254);
/** Several checkboxes with one name: each value once, at least one. */
const picks = <T extends readonly [string, ...string[]]>(values: T, msg: string) => z.array(z.enum(values, msg)).min(1, msg).max(values.length).transform((v) => [...new Set(v)]);

const website = z
  .string()
  .trim()
  .max(200, "Keep the website under 200 characters.")
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
  .refine((v) => !v || /^https?:\/\/[^\s/]+\.[^\s/]+(\/\S*)?$/i.test(v), "Use a website address like example.com.")
  .transform((v) => v || null);

export const FounderInput = z.object({
  name,
  email,
  affiliation: z.enum(FOUNDER_AFFILIATIONS, "Pick your NYU affiliation."),
  company: z.string().trim().min(1, "Add your company's name.").max(120, "Keep the company name under 120 characters."),
  oneLiner: z.string().trim().min(5, "Add a one-line description.").max(160, "Keep the description to one line (160 characters)."),
  stage: z.enum(FOUNDER_STAGES, "Pick your stage."),
  focus: picks(FOCUS, "Pick at least one focus: Blockchain, Finance or AI."),
  website,
  addMember: z.boolean(),
});
export type FounderFields = z.output<typeof FounderInput>;

export const SupporterInput = z.object({
  name,
  email,
  organization: z.string().trim().min(1, "Add your organization.").max(120, "Keep the organization under 120 characters."),
  help: picks(SUPPORT_KINDS, "Pick at least one way you'd help."),
  message: optText(1000).pipe(z.string().nullable()),
});
export type SupporterFields = z.output<typeof SupporterInput>;

export type InterestFields = ({ type: "founder" } & FounderFields) | ({ type: "supporter" } & SupporterFields);

/** Reads either form's FormData (checkbox groups via getAll) into its schema. */
export function parseInterest(type: InterestType, fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? "");
  const all = (k: string) => fd.getAll(k).map(String);
  if (type === "founder") {
    const r = FounderInput.safeParse({ name: s("name"), email: s("email"), affiliation: s("affiliation"), company: s("company"), oneLiner: s("oneLiner"), stage: s("stage"), focus: all("focus"), website: s("url"), addMember: fd.get("addMember") === "on" });
    return r.success ? { ok: true as const, data: { type, ...r.data } as InterestFields } : { ok: false as const, error: r.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const r = SupporterInput.safeParse({ name: s("name"), email: s("email"), organization: s("organization"), help: all("help"), message: s("message") });
  return r.success ? { ok: true as const, data: { type, ...r.data } as InterestFields } : { ok: false as const, error: r.error.issues[0]?.message ?? "Check the form and try again." };
}

/** `spam`: the bot guard's reason; a flagged row is saved but sends nothing (and joins no one) until "Not spam". */
export async function saveInterest(db: Db, d: InterestFields, spam: SpamReason | null = null) {
  const [row] = await db.insert(acceleratorInterest).values({ ...d, suspectedSpam: Boolean(spam), spamReason: spam }).returning({ id: acceleratorInterest.id });
  return row.id;
}

/** A founder as a new member: their NYU affiliation as "You are…" ("Other" joins as an industry professional), focus as blocks. */
export const founderAsMember = (d: FounderFields): NewMember => ({
  name: d.name, email: d.email, affiliation: d.affiliation === "other" ? "industry" : d.affiliation, blocks: d.focus, notify: ["accelerator"], src: FOUNDER_SOURCE,
});

/**
 * "Also add me as a member": the normal join (lib/member-join.ts), so a new member gets the one
 * welcome email and contact linking, and an existing email only gains the accelerator interest.
 */
export const joinFounder = (db: Db, d: FounderFields) => upsertMember(db, founderAsMember(d), "accelerator");

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ");

/** The one notification, to the recovery super admin; Reply goes straight to the submitter. */
export async function notifyInterest(db: Db, id: number, d: InterestFields) {
  const to = process.env.SUPER_ADMIN_EMAIL;
  if (!to) return;
  const lines = d.type === "founder"
    ? [
        `From: ${d.name} <${d.email}> · ${AFFILIATION_LABELS[d.affiliation]}`,
        `${d.company}: ${d.oneLiner}`,
        `Stage: ${STAGE_LABELS[d.stage]} · Focus: ${d.focus.map((f) => FOCUS_LABELS[f]).join(", ")}${d.website ? ` · ${d.website}` : ""}`,
        d.addMember ? "They also asked to be added as a member." : "",
      ]
    : [`From: ${d.name} <${d.email}>, ${d.organization}`, `Would like to: ${d.help.map((h) => HELP_LABELS[h]).join(", ")}`, d.message ?? ""];
  const label = d.type === "founder" ? "Founder" : "Supporter";
  const r = await sendEmail(db, "accelerator", {
    to,
    replyTo: d.email,
    subject: `Accelerator ${label.toLowerCase()}: ${oneLine(d.name)}${d.type === "founder" ? ` (${oneLine(d.company)})` : ""}`,
    ...renderEmail({
      kicker: `Accelerator interest #${id} · ${label}`,
      heading: d.type === "founder" ? "A founder got in touch" : "Someone wants to help",
      paragraphs: lines.filter(Boolean),
      note: "Reply to this email to answer them directly. It's also in /admin/inquiries/accelerator.",
    }),
  });
  if (!r.ok) console.error("accelerator notification not sent:", r.error);
}

export type InterestFilters = { type?: InterestType; status?: InterestStatus; stage?: (typeof FOUNDER_STAGES)[number]; focus?: (typeof FOCUS)[number] };

/** Filters from the query string; anything unknown is ignored. */
export function parseInterestFilters(sp: Record<string, string | string[] | undefined>): InterestFilters {
  const pick = <T extends string>(v: unknown, all: readonly T[]) => all.find((x) => x === v);
  return { type: pick(sp.type, INTEREST_TYPES), status: pick(sp.status, INTEREST_STATUSES), stage: pick(sp.stage, FOUNDER_STAGES), focus: pick(sp.focus, FOCUS) };
}

/** Newest first. Stage and focus only ever match founders. */
export function listInterest(db: Db, f: InterestFilters, limit?: number) {
  const where = and(
    f.type ? eq(acceleratorInterest.type, f.type) : undefined,
    f.status ? eq(acceleratorInterest.status, f.status) : undefined,
    f.stage ? eq(acceleratorInterest.stage, f.stage) : undefined,
    f.focus ? arrayContains(acceleratorInterest.focus, [f.focus]) : undefined,
  );
  const q = db.select().from(acceleratorInterest).where(where).orderBy(desc(acceleratorInterest.id));
  return limit ? q.limit(limit) : q;
}

/** Super admins only (checked by the caller). Logged with old → new. */
export async function setInterestStatus(db: Db, id: number, status: InterestStatus, actor: string): Promise<boolean> {
  const [old] = await db.select({ status: acceleratorInterest.status, type: acceleratorInterest.type }).from(acceleratorInterest).where(eq(acceleratorInterest.id, id));
  if (!old || old.status === status) return false;
  await db.batch([
    db.update(acceleratorInterest).set({ status }).where(eq(acceleratorInterest.id, id)),
    db.insert(adminAudit).values(auditRow(actor, "accelerator.status", `Accelerator ${old.type} #${id}`, { changes: { status: [old.status, status] } })),
  ]);
  return true;
}

/**
 * For removal requests (round 17); super admins only (checked by the caller). Permanent. Logged
 * as who, when and which row (founder or supporter), never its content.
 */
export async function deleteInterest(db: Db, id: number, actor: string): Promise<boolean> {
  const [gone] = await db.delete(acceleratorInterest).where(eq(acceleratorInterest.id, id)).returning({ type: acceleratorInterest.type });
  if (gone) await db.insert(adminAudit).values(auditRow(actor, "accelerator.delete", `Deleted accelerator ${gone.type} #${id}`));
  return Boolean(gone);
}
