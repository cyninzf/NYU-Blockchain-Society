import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { boilerplate } from "@/content/boilerplate";
import { notifyMessages } from "@/content/events";
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

const short = boilerplate.find((b) => b.id === "short")!.text;

/** The one welcome email, sent once when a new member joins (never on re-submits, never retroactively). */
export async function sendWelcome(db: Db, memberId: number, notify: string | null) {
  const [m] = await db.select({ email: members.email, unsubscribedAt: members.unsubscribedAt }).from(members).where(eq(members.id, memberId));
  if (!m || m.unsubscribedAt) return;
  // The block number is join order, so it only appears once the member count is public.
  const numbered = await countIsPublic(db);
  const heading = numbered ? `Block #${memberId} added. You're on the chain.` : "Block added. You're on the chain.";
  const note = notify && notify in notifyMessages ? notifyMessages[notify as keyof typeof notifyMessages] : null;
  const msg: Message = {
    to: m.email,
    subject: heading,
    ...renderEmail({
      kicker: numbered ? `Block #${memberId}` : "Welcome",
      heading,
      paragraphs: [short, ...(note ? [note] : []), "You can add or change your blocks, details and email preferences any time."],
      cta: { label: "Update your block", href: `${baseUrl()}/update` },
      note: "You're getting this because you added your block at nyublockchainsociety.com. This is the only automatic email; after this we only write about events and programs.",
      unsubscribeUrl: unsubscribeUrl(memberId),
    }),
    headers: unsubscribeHeaders(memberId),
  };
  const r = await sendEmail(db, "welcome", msg);
  if (!r.ok) console.error(`welcome email for #${memberId} not sent:`, r.error);
}
