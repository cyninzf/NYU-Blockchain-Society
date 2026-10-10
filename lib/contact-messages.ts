import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { baseUrl } from "./base-url";
import type { Db } from "./db";
import { CONTACT_TOPICS, contactMessages } from "./db/schema";
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

export async function saveContactMessage(db: Db, d: ContactFields) {
  const [row] = await db.insert(contactMessages).values(d).returning({ id: contactMessages.id });
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
