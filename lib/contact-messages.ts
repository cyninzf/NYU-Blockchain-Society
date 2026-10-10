import "server-only";
import { z } from "zod";
import type { Db } from "./db";
import { CONTACT_TOPICS, contactMessages } from "./db/schema";

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
