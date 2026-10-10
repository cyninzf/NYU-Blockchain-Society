import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auditRow } from "./admin";
import type { Db } from "./db";
import { adminAudit, conferenceInquiries, INQUIRY_INTERESTS, type InquiryStatus, type SpamReason } from "./db/schema";
import { renderEmail, sendEmail } from "./email";

// Sponsor and speaker inquiries from /conference (round 13). Stored, then one notification to
// SUPER_ADMIN_EMAIL with reply-to set to the inquirer; the inquirer gets no email.

export const INTEREST_LABELS: Record<(typeof INQUIRY_INTERESTS)[number], string> = { sponsor: "Sponsor", speak: "Speak", other: "Other" };

export const InquiryInput = z.object({
  name: z.string().trim().min(1, "Add your name.").max(120, "Keep the name under 120 characters."),
  email: z.email("Enter an email we can reply to, like name@example.com.").trim().max(254),
  company: z.string().trim().max(120, "Keep the company under 120 characters.").transform((v) => v || null),
  interest: z.enum(INQUIRY_INTERESTS, "Pick Sponsor, Speak or Other."),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(1000, "Keep the message under 1,000 characters."),
});
export type InquiryFields = z.output<typeof InquiryInput>;

/** `spam`: the bot guard's reason; a flagged inquiry is saved but sends nothing until "Not spam". */
export async function saveInquiry(db: Db, d: InquiryFields, edition: string, spam: SpamReason | null = null) {
  const [row] = await db.insert(conferenceInquiries).values({ ...d, edition, suspectedSpam: Boolean(spam), spamReason: spam }).returning({ id: conferenceInquiries.id });
  return row.id;
}

/** The one notification, to the recovery super admin; Reply goes straight to the inquirer. */
export async function notifyInquiry(db: Db, id: number, d: InquiryFields, edition: string) {
  const to = process.env.SUPER_ADMIN_EMAIL;
  if (!to) return;
  const r = await sendEmail(db, "inquiry", {
    to,
    replyTo: d.email,
    subject: `Conference ${edition} inquiry (${INTEREST_LABELS[d.interest]}): ${d.name.replace(/[\r\n]+/g, " ")}`,
    ...renderEmail({
      kicker: `Inquiry #${id} · ${INTEREST_LABELS[d.interest]}`,
      heading: `NYU Blockchain Conference ${edition}`,
      paragraphs: [`From: ${d.name} <${d.email}>${d.company ? `, ${d.company}` : ""}`, d.message],
      note: "Reply to this email to answer them directly. The inquiry is also in /admin/inquiries.",
    }),
  });
  if (!r.ok) console.error("inquiry notification not sent:", r.error);
}

/** Super admins only (checked by the caller). Logged with old → new. */
export async function setInquiryStatus(db: Db, id: number, status: InquiryStatus, actor: string): Promise<boolean> {
  const [old] = await db.select({ status: conferenceInquiries.status }).from(conferenceInquiries).where(eq(conferenceInquiries.id, id));
  if (!old || old.status === status) return false;
  await db.batch([
    db.update(conferenceInquiries).set({ status }).where(eq(conferenceInquiries.id, id)),
    db.insert(adminAudit).values(auditRow(actor, "inquiry.status", `Inquiry #${id}`, { changes: { status: [old.status, status] } })),
  ]);
  return true;
}

/**
 * For removal requests (round 17); super admins only (checked by the caller). Permanent. Logged
 * as who, when and which inquiry, never its content.
 */
export async function deleteInquiry(db: Db, id: number, actor: string): Promise<boolean> {
  const [gone] = await db.delete(conferenceInquiries).where(eq(conferenceInquiries.id, id)).returning({ id: conferenceInquiries.id });
  if (gone) await db.insert(adminAudit).values(auditRow(actor, "inquiry.delete", `Deleted conference inquiry #${id}`));
  return Boolean(gone);
}
