import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { boilerplate } from "@/content/boilerplate";
import { baseUrl } from "./base-url";
import { renderEmail, type Message } from "./email";
import { eventWhen } from "./event-time";
import { seal, unseal } from "./security";

// The one-time invite email to a contact (round 12) and its two tokens, both encrypted
// (AES-256-GCM via seal), so a link never shows a contact id or anything else:
// - the join token: pre-fills their email in the join flow and links the contact when they
//   join; works once (contacts.invite_used_at) and expires after 60 days;
// - the unsubscribe token: never expires, puts the address on the suppression list.

export const INVITE_TTL_MS = 60 * 24 * 60 * 60 * 1000;

export const inviteToken = (contactId: number, now = Date.now()) => seal(`i.${contactId}.${now + INVITE_TTL_MS}`);
export function contactFromInviteToken(t: string): number | null {
  const [kind, id, exp] = (unseal(t) ?? "").split(".");
  const n = Number(id);
  return kind === "i" && Number.isInteger(n) && n > 0 && Date.now() < Number(exp) ? n : null;
}

export const contactUnsubscribeToken = (contactId: number) => seal(`c.${contactId}`);
export function contactFromUnsubscribeToken(t: string): number | null {
  const [kind, id] = (unseal(t) ?? "").split(".");
  const n = Number(id);
  return kind === "c" && Number.isInteger(n) && n > 0 ? n : null;
}

/** The join source for an invite from this import: invite-<source>, within the 40-character limit. */
export const inviteSource = (source: string) => `invite-${source}`.slice(0, 40).replace(/-+$/, "");

const oneLiner = boilerplate.find((b) => b.id === "one-liner")!.text;

/** The editable parts of an invite. `{first_name}` in the body becomes the contact's first name. */
export const InviteDraft = z.object({
  subject: z.string().trim().min(3, "Add a subject.").max(150, "Keep the subject under 150 characters."),
  body: z.string().trim().min(10, "Write the invite.").max(4000, "Keep it under 4,000 characters."),
  /** Why they're receiving it, in the footer. */
  reason: z.string().trim().min(10, "Say why they're receiving it.").max(200),
});
export type InviteDraft = z.infer<typeof InviteDraft>;

export const DEFAULT_INVITE: InviteDraft = {
  subject: "An invitation to NYU Blockchain Society",
  body: [
    "Hi {first_name},",
    "You registered for the 2024 NYU Blockchain Conference at New York University, so we wanted to reach out personally.",
    oneLiner,
    "We'd love to have you in the network. Adding your block takes under a minute: pick your fields, add your name, and you're in.",
  ].join("\n\n"),
  reason: "You registered for the 2024 NYU Blockchain Conference.",
};

export type FeaturedEvent = { title: string; startsAt: Date; endsAt: Date | null; venueName: string | null };

/** Ties a real send to an earlier test of exactly the same invite (text, footer reason and featured event). */
export const inviteHash = (d: InviteDraft, eventId: number | null) =>
  createHash("sha256").update(JSON.stringify([d.subject, d.body, d.reason, eventId])).digest("base64url");

const paragraphs = (body: string) => body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const firstNameOf = (name: string | null) => name?.trim().split(/\s+/)[0] || "there";

/**
 * One invite. `contact` is null for the test to the admin: the links then only show where the
 * real ones go. Each real invite carries its own join token, unsubscribe link and one-click headers.
 */
export function inviteEmail(d: InviteDraft, o: {
  to: string; source: string; contact: { id: number; name: string | null } | null; event: FeaturedEvent | null; postalAddress: string;
}): Message {
  const base = baseUrl();
  const test = o.contact === null;
  const join = `${base}/?join=1&src=${inviteSource(o.source)}${test ? "" : `&invite=${encodeURIComponent(inviteToken(o.contact!.id))}`}`;
  const unsub = test ? `${base}/unsubscribe` : `${base}/unsubscribe?t=${encodeURIComponent(contactUnsubscribeToken(o.contact!.id))}`;
  const body = d.body.replace(/\{first_name\}/g, firstNameOf(o.contact?.name ?? null));
  const event = o.event
    ? [`Coming up: ${o.event.title}, ${eventWhen(o.event.startsAt, o.event.endsAt)}${o.event.venueName ? `, ${o.event.venueName}` : ""}. Members get the invite first.`]
    : [];
  return {
    to: o.to,
    subject: test ? `[Test] ${d.subject}` : d.subject,
    ...renderEmail({
      kicker: test ? "Test · Invitation" : "Invitation",
      heading: "Add your block",
      paragraphs: [...paragraphs(body), ...event],
      cta: { label: "Add your block", href: join },
      note: test ? `This is a test. Each contact gets their own join and unsubscribe links. ${d.reason}` : `${d.reason} This is a one-time invitation: we won't email you again unless you join.`,
      unsubscribeUrl: unsub,
      postalAddress: o.postalAddress,
    }),
    ...(test ? {} : {
      headers: {
        "List-Unsubscribe": `<${base}/api/unsubscribe?t=${encodeURIComponent(contactUnsubscribeToken(o.contact!.id))}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  };
}
