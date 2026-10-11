import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { notifyMessages } from "@/content/notify";
import { links } from "@/content/site";
import { baseUrl } from "./base-url";
import type { Db } from "./db";
import { members } from "./db/schema";
import { renderEmail, sendEmail, type Message } from "./email";
import { countIsPublic } from "./chain-stats";
import { seal, unseal, verify } from "./security";

// Emails to members: every one carries a working unsubscribe link (and the one-click headers
// mail apps use), and unsubscribed members get nothing at all.

/** Encrypted (no readable member id), never expires: unsubscribing must always work, with no login. */
export const unsubscribeToken = (memberId: number) => seal(`u.${memberId}`);
export function memberFromUnsubscribeToken(t: string): number | null {
  // Older links were signed, not encrypted: still honoured.
  const [kind, id] = (unseal(t) ?? verify(t) ?? "").split(".");
  const n = Number(id);
  return kind === "u" && Number.isInteger(n) && n > 0 ? n : null;
}

export const unsubscribeUrl = (memberId: number) => `${baseUrl()}/unsubscribe?t=${encodeURIComponent(unsubscribeToken(memberId))}`;

/** RFC 8058 one-click unsubscribe: mail apps POST to this URL. */
export const unsubscribeHeaders = (memberId: number) => ({
  "List-Unsubscribe": `<${baseUrl()}/api/unsubscribe?t=${encodeURIComponent(unsubscribeToken(memberId))}>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});

/** Sets unsubscribed_at once (the first time is kept). True when the member exists. */
export async function setUnsubscribed(db: Db, memberId: number, on: boolean): Promise<boolean> {
  const rows = on
    ? await db.update(members).set({ unsubscribedAt: new Date() }).where(and(eq(members.id, memberId), isNull(members.unsubscribedAt))).returning({ id: members.id })
    : await db.update(members).set({ unsubscribedAt: null }).where(eq(members.id, memberId)).returning({ id: members.id });
  if (rows.length) return true;
  const [m] = await db.select({ id: members.id }).from(members).where(eq(members.id, memberId));
  return Boolean(m);
}

// The welcome email's copy (round 22, set by the maintainer).
export const WELCOME = {
  paragraphs: [
    "NYU Blockchain Society is the professional network for NYU alumni at the intersection of blockchain, finance, and AI, and an official NYU Alumni Club.",
    "Through events, programs, and support for NYU founders, we connect the alumni, builders, investors, and institutions shaping these industries.",
  ],
  cta: "Update your profile",
  note: "You joined at nyublockchainsociety.com. This is our only automatic email; after this, we'll only write about relevant events and programs.",
};

/**
 * The welcome email for one member. `memberId` null: a test for an admin ("[Test]" subject, an
 * unsubscribe link that does nothing, no one-click headers).
 */
export function welcomeEmail(to: string, memberId: number | null, numbered: boolean, notify: string | null): Message {
  const heading = numbered && memberId !== null ? `Block #${memberId} added. You're on the chain.` : "Block added. You're on the chain.";
  const note = notify && notify in notifyMessages ? notifyMessages[notify as keyof typeof notifyMessages] : null;
  return {
    to,
    subject: memberId === null ? `[Test] ${heading}` : heading,
    ...renderEmail({
      kicker: memberId === null ? "Test · Welcome" : numbered ? `Block #${memberId}` : "Welcome",
      heading,
      paragraphs: [...WELCOME.paragraphs, ...(note ? [note] : [])],
      cta: { label: WELCOME.cta, href: `${baseUrl()}/update` },
      linksLine: ["Follow us on ", { label: "LinkedIn", href: links.linkedin }, " and ", { label: "X", href: links.x }],
      note: WELCOME.note,
      unsubscribeUrl: memberId === null ? `${baseUrl()}/unsubscribe` : unsubscribeUrl(memberId),
    }),
    ...(memberId === null ? {} : { headers: unsubscribeHeaders(memberId) }),
  };
}

/** The one welcome email, sent once when a new member joins (never on re-submits, never retroactively). */
export async function sendWelcome(db: Db, memberId: number, notify: string | null) {
  const [m] = await db.select({ email: members.email, unsubscribedAt: members.unsubscribedAt }).from(members).where(eq(members.id, memberId));
  if (!m || m.unsubscribedAt) return;
  // The block number is join order, so it only appears once the member count is public.
  const r = await sendEmail(db, "welcome", welcomeEmail(m.email, memberId, await countIsPublic(db), notify));
  if (!r.ok) console.error(`welcome email for #${memberId} not sent:`, r.error);
}
