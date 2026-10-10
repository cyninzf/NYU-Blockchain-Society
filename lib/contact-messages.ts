import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { baseUrl } from "./base-url";
import type { Db } from "./db";
import { TOPIC_LABELS } from "@/content/contact";
import { auditRow } from "./admin";
import { adminAudit, CONTACT_TOPICS, contactMessages, type ContactStatus, type SpamReason } from "./db/schema";
import { renderEmail, sendEmail } from "./email";
import { CONTACT_LINK_TTL_MS, consumeLinkToken, createLinkToken } from "./magic-link";

// Messages from /contact (round 19), the inquiry pattern: stored, then (item 2/3) a confirmation
// link for privacy requests and one notification to SUPER_ADMIN_EMAIL.

export const ContactInput = z.object({
  name: z.string().trim().min(1, "Add your name.").max(120, "Keep the name under 120 characters."),
  email: z.email("Enter an email we can reply to, like name@example.com.").trim().max(254),
  topic: z.enum(CONTACT_TOPICS, "Pick a topic."),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(1000, "Keep the message under 1,000 characters."),
});
export type ContactFields = z.output<typeof ContactInput>;

/** `spam`: the bot guard's reason; a flagged message is saved but sends nothing until "Not spam". */
export async function saveContactMessage(db: Db, d: ContactFields, spam: SpamReason | null = null) {
  const [row] = await db.insert(contactMessages).values({ ...d, suspectedSpam: Boolean(spam), spamReason: spam }).returning({ id: contactMessages.id });
  return row.id;
}

/**
 * Privacy requests (access, delete): one email to the address given, with a single-use link that
 * expires in 48 hours (round 19). Sent through sendEmail, so the daily limit and the bounce and
 * spam suppressions apply. Never resent: one email per request.
 */
export async function sendContactVerification(db: Db, id: number, email: string) {
  const token = await createLinkToken(db, "contact", String(id), CONTACT_LINK_TTL_MS);
  const r = await sendEmail(db, "contact-verify", {
    to: email,
    subject: "Confirm your privacy request",
    ...renderEmail({
      kicker: "Privacy request",
      heading: "Confirm it's you",
      paragraphs: [
        "We received a privacy request from this email address through the contact form on nyublockchainsociety.com.",
        "To protect your data, we only act on it once you confirm it comes from you. The link works once and expires in 48 hours.",
      ],
      cta: { label: "Confirm my request", href: `${baseUrl()}/contact/verify?t=${token}` },
      note: "If you didn't send this request, ignore this email: nothing happens without the button.",
    }),
  });
  if (!r.ok) console.error("contact verification not sent:", r.error);
}

/** The confirmation link's button: marks the request verified. False for a used, expired or unknown link. */
export async function verifyContactMessage(db: Db, token: string): Promise<boolean> {
  const id = Number(await consumeLinkToken(db, "contact", token));
  if (!Number.isInteger(id) || id < 1) return false;
  await db.update(contactMessages).set({ verifiedAt: new Date() }).where(and(eq(contactMessages.id, id), isNull(contactMessages.verifiedAt)));
  return true;
}

/**
 * One notification per new message to the recovery super admin (round 19), Reply going to the
 * sender. Counts toward the shared daily email limit like every other email.
 */
export async function notifyContactMessage(db: Db, id: number, d: ContactFields) {
  const to = process.env.SUPER_ADMIN_EMAIL;
  if (!to) return;
  const privacy = d.topic !== "general";
  const r = await sendEmail(db, "contact", {
    to,
    replyTo: d.email,
    subject: `Contact (${TOPIC_LABELS[d.topic]}): ${d.name.replace(/[\r\n]+/g, " ")}`,
    ...renderEmail({
      kicker: `Contact message #${id} · ${TOPIC_LABELS[d.topic]}`,
      heading: privacy ? "A privacy request came in" : "A new message came in",
      paragraphs: [
        `From: ${d.name} <${d.email}>`,
        d.message,
        ...(privacy ? ["Unverified for now: we've emailed the sender a link to confirm it's them. Act on it only once /admin/inquiries/contact shows it as Verified."] : []),
      ],
      note: "Reply to this email to answer them directly. It's also in /admin/inquiries/contact.",
    }),
  });
  if (!r.ok) console.error("contact notification not sent:", r.error);
}

/** Super admins only (checked by the caller). Logged with old → new. */
export async function setContactStatus(db: Db, id: number, status: ContactStatus, actor: string): Promise<boolean> {
  const [old] = await db.select({ status: contactMessages.status }).from(contactMessages).where(eq(contactMessages.id, id));
  if (!old || old.status === status) return false;
  await db.batch([
    db.update(contactMessages).set({ status }).where(eq(contactMessages.id, id)),
    db.insert(adminAudit).values(auditRow(actor, "contact_message.status", `Contact message #${id}`, { changes: { status: [old.status, status] } })),
  ]);
  return true;
}

/** For removal requests; super admins only (checked by the caller). Permanent. Logged as who, when and which message, never its content. */
export async function deleteContactMessage(db: Db, id: number, actor: string): Promise<boolean> {
  const [gone] = await db.delete(contactMessages).where(eq(contactMessages.id, id)).returning({ id: contactMessages.id });
  if (gone) await db.insert(adminAudit).values(auditRow(actor, "contact_message.delete", `Deleted contact message #${id}`));
  return Boolean(gone);
}

/**
 * "Not spam" (round 20; super admins, checked by the caller): back to normal, then what was
 * skipped: the sender's confirmation link for a privacy request and the notification. Claimed with
 * one update, so it happens once. Logged without content.
 */
export async function markContactNotSpam(db: Db, id: number, actor: string): Promise<boolean> {
  const [r] = await db.update(contactMessages).set({ suspectedSpam: false })
    .where(and(eq(contactMessages.id, id), eq(contactMessages.suspectedSpam, true))).returning();
  if (!r) return false;
  await db.insert(adminAudit).values(auditRow(actor, "contact_message.not_spam", `Marked contact message #${id} not spam`));
  if (r.topic !== "general") await sendContactVerification(db, id, r.email);
  await notifyContactMessage(db, id, { name: r.name, email: r.email, topic: r.topic, message: r.message });
  return true;
}
