import "server-only";
import { and, arrayContains, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { AFFILIATION_LABELS, FOCUS, FOCUS_LABELS, HELP_LABELS, NEEDS_LABELS, STAGE_LABELS } from "@/content/accelerator";
import { auditRow } from "./admin";
import type { Db } from "./db";
import { type AcceleratorInterest, acceleratorInterest, adminAudit, contacts, FOUNDER_AFFILIATIONS, FOUNDER_NEEDS, FOUNDER_STAGES, INTEREST_STATUSES, INTEREST_TYPES, type InterestStatus, type InterestType, type SpamReason } from "./db/schema";
import type { Defer } from "./defer";
import { renderEmail, sendEmail } from "./email";
import { upsertMember, type NewMember } from "./member-join";
import { gradYear, linkedinUrl, optText } from "./member-fields";
import { zodFieldErrors } from "./form-errors";
import { saveContact } from "./contact-save";
import { CONTACT_FOCUS, normalizeLinkedin, type ContactType } from "./contact-fields";
import { FORM_SOURCES } from "./contacts-import";
import { reportError } from "./monitoring";

// Accelerator interest from /accelerator (round 14), the round 13 inquiry pattern: stored, then
// one notification to SUPER_ADMIN_EMAIL with reply-to set to the submitter, who gets no email.
// A founder who ticks "Also add me as a member" also joins (notify accelerator, src accelerator-founder).
// Round 28: investors replace the supporter form (old supporter rows stay, read-only), and every
// submission that isn't suspected spam creates or fills a contact (fill-empty-only, on email).

export const FOUNDER_SOURCE = "accelerator-founder";
/** The contacts' sources (round 28). Not "via-": these people wrote to us themselves. */
// Both are protected sources: never in a bulk invite unless explicitly chosen (FORM_SOURCES, round 28.1).
export const [FOUNDER_CONTACT_SOURCE, INVESTOR_CONTACT_SOURCE] = FORM_SOURCES;

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
  /** Round 28, all optional. */
  linkedinUrl,
  school: optText(120).pipe(z.string().nullable()),
  gradYear,
  needs: z.array(z.enum(FOUNDER_NEEDS, "Pick from the list.")).max(FOUNDER_NEEDS.length).transform((v) => FOUNDER_NEEDS.filter((n) => v.includes(n))),
  addMember: z.boolean(),
});
export type FounderFields = z.output<typeof FounderInput>;

/** "I'm an investor" (round 28): the investor list for founder showcases. */
export const InvestorInput = z.object({
  name,
  email,
  firm: optText(120).pipe(z.string().nullable()),
  focus: picks(FOCUS, "Pick at least one focus: Blockchain, Finance or AI."),
});
export type InvestorFields = z.output<typeof InvestorInput>;

/** Supporter rows from before round 28 (read-only: the form is gone). */
export type SupporterFields = { name: string; email: string; organization: string; help: string[]; message: string | null };

export type InterestFields = ({ type: "founder" } & FounderFields) | ({ type: "investor" } & InvestorFields) | ({ type: "supporter" } & SupporterFields);
/** The two forms on /accelerator today. */
export type FormType = "founder" | "investor";

/** No firm, or "Angel": an angel; otherwise a VC. */
export const investorType = (firm: string | null): ContactType => (!firm || /^angel( investor)?$/i.test(firm.trim()) ? "angel" : "vc");

/** Reads either form's FormData (checkbox groups via getAll) into its schema. */
export function parseInterest(type: FormType, fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? "");
  const all = (k: string) => fd.getAll(k).map(String);
  if (type === "founder") {
    const r = FounderInput.safeParse({
      name: s("name"), email: s("email"), affiliation: s("affiliation"), company: s("company"), oneLiner: s("oneLiner"), stage: s("stage"), focus: all("focus"), website: s("url"),
      linkedinUrl: s("linkedinUrl"), school: s("school"), gradYear: s("gradYear"), needs: all("needs"), addMember: fd.get("addMember") === "on",
    });
    return r.success ? { ok: true as const, data: { type, ...r.data } as InterestFields } : { ok: false as const, error: r.error.issues[0]?.message ?? "Check the form and try again.", fieldErrors: zodFieldErrors(r.error, { website: "url" }) };
  }
  const r = InvestorInput.safeParse({ name: s("name"), email: s("email"), firm: s("firm"), focus: all("focus") });
  return r.success ? { ok: true as const, data: { type, ...r.data } as InterestFields } : { ok: false as const, error: r.error.issues[0]?.message ?? "Check the form and try again.", fieldErrors: zodFieldErrors(r.error) };
}

/** `spam`: the bot guard's reason; a flagged row is saved but sends nothing (and joins no one) until "Not spam". */
export async function saveInterest(db: Db, d: InterestFields, spam: SpamReason | null = null) {
  // An investor's firm is stored as the organization.
  const values = d.type === "investor" ? { type: d.type, name: d.name, email: d.email, organization: d.firm, focus: d.focus } : d;
  const [row] = await db.insert(acceleratorInterest).values({ ...values, suspectedSpam: Boolean(spam), spamReason: spam }).returning({ id: acceleratorInterest.id });
  return row.id;
}

/**
 * Round 28: the submission as a contact, created or filled (empty fields only, matched on email):
 * founders as Founder (source accelerator-form), investors as VC or Angel (source investor-list),
 * focus copied, relationship Replied (only ever forward), a dated note naming the submission.
 * Stored on the row (`contactId`) so admins see the link. Never a member, never an email.
 */
export async function contactFromInterest(db: Db, id: number, d: InterestFields) {
  if (d.type === "supporter") return null;
  const focus = CONTACT_FOCUS.filter((f) => (d.focus as string[]).includes(f));
  const r = await saveContact(db, d.type === "founder"
    ? {
        name: d.name, email: d.email.toLowerCase(), company: d.company, linkedinUrl: normalizeLinkedin(d.linkedinUrl), contactType: "founder", focus,
        nyuAlum: d.affiliation === "alumni" ? true : null, relationship: "replied", source: FOUNDER_CONTACT_SOURCE,
      }
    : {
        name: d.name, email: d.email.toLowerCase(), company: investorType(d.firm) === "vc" ? d.firm : null, contactType: investorType(d.firm), focus,
        relationship: "replied", source: INVESTOR_CONTACT_SOURCE,
      },
  d.type === "founder" ? `Accelerator founder form (#${id})` : `Investor list sign-up (#${id})`);
  await db.update(acceleratorInterest).set({ contactId: r.id }).where(eq(acceleratorInterest.id, id));
  return r.id;
}

/** The contact never blocks the submission: a failure is reported, and the row is still saved and notified. */
const contactQuietly = (db: Db, id: number, d: InterestFields) => contactFromInterest(db, id, d).catch((e) => { reportError("forms", "accelerator contact failed", e); return null; });

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
        d.linkedinUrl ? `LinkedIn: ${d.linkedinUrl}` : "",
        d.school || d.gradYear ? `NYU: ${[d.school, d.gradYear].filter(Boolean).join(" ")}` : "",
        d.needs.length ? `What would help most: ${d.needs.map((n) => NEEDS_LABELS[n]).join(", ")}` : "",
        d.addMember ? "They also asked to be added as a member." : "",
      ]
    : d.type === "investor"
      ? [`From: ${d.name} <${d.email}>, ${d.firm ?? "no firm given (angel)"}`, `Focus: ${d.focus.map((f) => FOCUS_LABELS[f]).join(", ")}`, "They joined the investor list for founder showcases. They're now a contact (investor-list)."]
      : [`From: ${d.name} <${d.email}>, ${d.organization}`, `Would like to: ${d.help.map((h) => HELP_LABELS[h as keyof typeof HELP_LABELS] ?? h).join(", ")}`, d.message ?? ""];
  const label = d.type === "founder" ? "Founder" : d.type === "investor" ? "Investor" : "Supporter";
  const r = await sendEmail(db, "accelerator", {
    to,
    replyTo: d.email,
    subject: `Accelerator ${label.toLowerCase()}: ${oneLine(d.name)}${d.type === "founder" ? ` (${oneLine(d.company)})` : ""}`,
    ...renderEmail({
      kicker: `Accelerator interest #${id} · ${label}`,
      heading: d.type === "founder" ? "A founder got in touch" : d.type === "investor" ? "An investor joined the list" : "Someone wants to help",
      paragraphs: lines.filter(Boolean),
      note: "Reply to this email to answer them directly. It's also in /admin/inquiries/accelerator.",
    }),
  });
  if (!r.ok) console.error("accelerator notification not sent:", r.error);
}

export type InterestFilters = { type?: InterestType; status?: InterestStatus; stage?: (typeof FOUNDER_STAGES)[number]; focus?: (typeof FOCUS)[number]; spam?: "1" | "0" };

/** Filters from the query string; anything unknown is ignored. */
export function parseInterestFilters(sp: Record<string, string | string[] | undefined>): InterestFilters {
  const pick = <T extends string>(v: unknown, all: readonly T[]) => all.find((x) => x === v);
  return { type: pick(sp.type, INTEREST_TYPES), status: pick(sp.status, INTEREST_STATUSES), stage: pick(sp.stage, FOUNDER_STAGES), focus: pick(sp.focus, FOCUS), spam: pick(sp.spam, ["1", "0"] as const) };
}

/** Newest first. Stage and focus only ever match founders. */
export function listInterest(db: Db, f: InterestFilters, limit?: number) {
  const where = and(
    f.type ? eq(acceleratorInterest.type, f.type) : undefined,
    f.status ? eq(acceleratorInterest.status, f.status) : undefined,
    f.stage ? eq(acceleratorInterest.stage, f.stage) : undefined,
    f.focus ? arrayContains(acceleratorInterest.focus, [f.focus]) : undefined,
    f.spam ? eq(acceleratorInterest.suspectedSpam, f.spam === "1") : undefined,
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
 * as who, when and which row (founder, investor or supporter), never its content. With
 * `alsoContact` (round 28.1) the linked contact goes too.
 */
export async function deleteInterest(db: Db, id: number, actor: string, alsoContact = false): Promise<boolean> {
  const [gone] = await db.delete(acceleratorInterest).where(eq(acceleratorInterest.id, id)).returning({ type: acceleratorInterest.type, contactId: acceleratorInterest.contactId });
  if (!gone) return false;
  // Round 28.1: "Also delete the linked record" (a removal request covers both). Logged without content.
  const contact = alsoContact && gone.contactId ? (await db.delete(contacts).where(eq(contacts.id, gone.contactId)).returning({ id: contacts.id }))[0] : undefined;
  await db.batch([
    db.insert(adminAudit).values(auditRow(actor, "accelerator.delete", `Deleted accelerator ${gone.type} #${id}${contact ? ` and its linked contact #${contact.id}` : ""}`)),
    ...(contact ? [db.insert(adminAudit).values(auditRow(actor, "contact.delete", `Deleted contact #${contact.id} (linked to deleted accelerator ${gone.type} #${id})`))] : []),
  ]);
  return true;
}

/** A stored row back into the form's fields (for the notification and the member join). */
function fieldsOf(r: AcceleratorInterest): InterestFields {
  return r.type === "founder"
    ? {
        type: "founder", name: r.name, email: r.email, affiliation: r.affiliation!, company: r.company ?? "", oneLiner: r.oneLiner ?? "", stage: r.stage!, focus: r.focus as FounderFields["focus"], website: r.website,
        linkedinUrl: r.linkedinUrl, school: r.school, gradYear: r.gradYear, needs: r.needs as FounderFields["needs"], addMember: r.addMember,
      }
    : r.type === "investor"
      ? { type: "investor", name: r.name, email: r.email, firm: r.organization, focus: r.focus as InvestorFields["focus"] }
      : { type: "supporter", name: r.name, email: r.email, organization: r.organization ?? "", help: r.help, message: r.message };
}

/**
 * "Not spam" (round 20; super admins, checked by the caller): back to normal, then what was
 * skipped: the contact (round 28), the member join for a founder who ticked "Also add me as a member" (with its welcome
 * email) and the notification. Claimed with one update, so it happens once. Logged without content.
 */
export async function markInterestNotSpam(db: Db, id: number, actor: string): Promise<boolean> {
  const [r] = await db.update(acceleratorInterest).set({ suspectedSpam: false })
    .where(and(eq(acceleratorInterest.id, id), eq(acceleratorInterest.suspectedSpam, true))).returning();
  if (!r) return false;
  await db.insert(adminAudit).values(auditRow(actor, "accelerator.not_spam", `Marked accelerator ${r.type} #${id} not spam`));
  const d = fieldsOf(r);
  await contactQuietly(db, id, d);
  if (d.type === "founder" && d.addMember) await joinFounder(db, d);
  await notifyInterest(db, id, d);
  return true;
}

/**
 * Save, then (unless flagged as suspected spam) the contact (round 28), the member join for
 * "Also add me as a member" and the notification after the response. The same result whether or
 * not the email was a member or a contact. The contact comes before the join, so the join's
 * automatic linking finds it.
 */
export async function receiveInterest(db: Db, d: InterestFields, spam: SpamReason | null, defer: Defer) {
  const id = await saveInterest(db, d, spam);
  if (spam) return id;
  await contactQuietly(db, id, d);
  if (d.type === "founder" && d.addMember) await joinFounder(db, d);
  defer(() => notifyInterest(db, id, d));
  return id;
}
