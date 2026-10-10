import "server-only";
import { createHash } from "node:crypto";
import { and, arrayOverlaps, eq, isNull, type SQL } from "drizzle-orm";
import { z } from "zod";
import { NOTIFY } from "@/content/notify";
import { INDUSTRY_IDS } from "@/content/industries";
import { baseUrl } from "./base-url";
import type { Db } from "./db";
import { AFFILIATIONS, members, type AnnouncementFilters } from "./db/schema";
import { renderEmail, type Message } from "./email";
import { unsubscribeHeaders, unsubscribeUrl } from "./member-email";

export const Filters = z.object({
  blocks: z.array(z.enum(INDUSTRY_IDS)).max(3).optional(),
  notify: z.array(z.enum(NOTIFY)).max(NOTIFY.length).optional(),
  affiliation: z.enum(AFFILIATIONS).optional(),
  country: z.string().trim().max(120).optional(),
});

export const Content = z.object({
  subject: z.string().trim().min(3, "Add a subject.").max(150, "Keep the subject under 150 characters."),
  body: z.string().trim().min(10, "Write the announcement.").max(8000, "Keep it under 8,000 characters."),
});

/** Ties a send to an earlier test of exactly the same text. */
export const contentHash = (c: z.infer<typeof Content>) => createHash("sha256").update(`${c.subject}\n\n${c.body}`).digest("base64url");

/** Members matching the filters (any of the picked blocks / notify interests), never unsubscribed ones. */
export function recipientWhere(f: AnnouncementFilters): SQL {
  const where: SQL[] = [isNull(members.unsubscribedAt)];
  if (f.blocks?.length) where.push(arrayOverlaps(members.blocks, f.blocks));
  if (f.notify?.length) where.push(arrayOverlaps(members.notify, f.notify));
  if (f.affiliation) where.push(eq(members.affiliation, f.affiliation as (typeof AFFILIATIONS)[number]));
  if (f.country) where.push(eq(members.country, f.country));
  return and(...where)!;
}

export const recipients = (db: Db, f: AnnouncementFilters) =>
  db.select({ id: members.id, email: members.email }).from(members).where(recipientWhere(f));

/** Blank-line separated paragraphs, as typed. */
const paragraphs = (body: string) => body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

export function announcementEmail(c: z.infer<typeof Content>, to: string, memberId: number | null, postalAddress: string | null = null): Message {
  return {
    to,
    subject: memberId === null ? `[Test] ${c.subject}` : c.subject,
    ...renderEmail({
      kicker: memberId === null ? "Test · NYU Blockchain Society" : "NYU Blockchain Society",
      heading: c.subject,
      paragraphs: paragraphs(c.body),
      note: memberId === null
        ? "This is a test. Members get the same email with their own unsubscribe link."
        : "You're getting this as a member of NYU Blockchain Society.",
      // A test has no member, so its link only shows where the real one goes.
      unsubscribeUrl: memberId === null ? `${baseUrl()}/unsubscribe` : unsubscribeUrl(memberId),
      postalAddress,
    }),
    ...(memberId === null ? {} : { headers: unsubscribeHeaders(memberId) }),
  };
}
