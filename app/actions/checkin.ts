"use server";

// Event check-in at /events/<slug>/checkin. Three ways in, none of which reveals whether an
// email belongs to a member:
// - a member session (from "Update your block" or an earlier check-in link): one button;
// - an email: if it's a member's, they get a one-tap check-in link (same rules as /update), and
//   everyone sees the same answer plus a short join form;
// - the join form: a new email joins and is checked in at once; an existing email is never
//   checked in unverified (it gets the one-tap link instead), with the same answer on screen.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { countIsPublic } from "@/lib/chain-stats";
import { checkinEvent, recordCheckin, sendCheckinLink } from "@/lib/checkin";
import { getDb } from "@/lib/db";
import { AFFILIATIONS } from "@/lib/db/schema";
import { emailConfigured } from "@/lib/email";
import { eventSource } from "@/lib/event-fields";
import { consumeLinkToken } from "@/lib/magic-link";
import { upsertMember } from "@/lib/member-join";
import { memberIdFromSession } from "@/lib/member-session";
import { rateLimited, rateLimitedEmail, verify } from "@/lib/security";
import { cookieOptions, MEMBER_COOKIE, MEMBER_SESSION_MS } from "@/lib/session-token";
import { createSession } from "@/lib/sessions";

export type CheckinResult = { ok: true; n: number | null; viaJoin?: boolean } | { ok: false; error: string };
export type EmailStep = { ok: true } | { ok: false; error: string };

const GENERIC = "Something went wrong on our side. Please try again in a moment.";
const LIMITED = "Too many attempts. Please try again in a few minutes.";
const CLOSED = "Check-in isn't open for this event right now.";
const MIN_FILL_MS = 3000;

async function openEvent(slug: string) {
  const db = getDb();
  if (!db || !/^[a-z0-9-]{1,40}$/.test(slug)) return null;
  const e = await checkinEvent(db, slug);
  return e && e.window === "open" ? { db, e } : null;
}

/** A member with a session checks themselves in with one button. */
export async function checkInSelf(slug: string): Promise<CheckinResult> {
  const id = await memberIdFromSession();
  if (!id) return { ok: false, error: "Your sign-in has expired. Enter your email below instead." };
  const o = await openEvent(slug);
  if (!o) return { ok: false, error: CLOSED };
  try {
    await recordCheckin(o.db, o.e.id, id, "qr");
    return { ok: true, n: (await countIsPublic(o.db)) ? id : null };
  } catch (e) {
    console.error("check-in failed", e instanceof Error ? e.message : e);
    return { ok: false, error: GENERIC };
  }
}

const Email = z.email("Enter your email, like name@example.com.").trim().max(254);

/** Step 1 without a session: the same answer for any valid email; members get a one-tap link. */
export async function requestCheckin(slug: string, email: string): Promise<EmailStep> {
  const parsed = Email.safeParse(email);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your email." };
  const o = await openEvent(slug);
  if (!o) return { ok: false, error: CLOSED };
  // Per IP and per email, counted before anything depends on whether the email is a member.
  if (await rateLimited(o.db, "checkin", 10, 600)) return { ok: false, error: LIMITED };
  if (await rateLimitedEmail(o.db, "checkin", parsed.data, 3, 900)) return { ok: false, error: LIMITED };
  // The lookup and the send happen after the response, so its timing can't tell members apart.
  if (emailConfigured()) after(() => sendCheckinLink(o.db, parsed.data, o.e).catch((e) => console.error("check-in link failed", e instanceof Error ? e.message : e)));
  return { ok: true };
}

const JoinInput = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,40}$/),
  formToken: z.string().max(200),
  website: z.string().max(200), // honeypot
  name: z.string().trim().min(1, "Add your name.").max(120),
  email: Email,
  affiliation: z.enum(AFFILIATIONS).exclude(["friend"]),
});

/**
 * Step 2: the short join form. A new email joins (source event-<slug>) and is checked in at once.
 * An existing email isn't checked in without proof: it gets the one-tap link instead. The answer
 * on screen is the same either way.
 */
export async function checkinJoin(input: z.input<typeof JoinInput>): Promise<CheckinResult> {
  const parsed = JoinInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const d = parsed.data;
  const issued = Number(verify(d.formToken)?.split(".")[1]);
  if (!issued) return { ok: false, error: "This form expired. Please reload the page and try again." };
  // Bots: the honeypot or an instant submit get the normal answer and nothing is stored.
  if (d.website || Date.now() - issued < MIN_FILL_MS) return { ok: true, n: null, viaJoin: true };
  const o = await openEvent(d.slug);
  if (!o) return { ok: false, error: CLOSED };
  try {
    if (await rateLimited(o.db, "checkin-join", 8, 600)) return { ok: false, error: LIMITED };
    if (await rateLimitedEmail(o.db, "checkin-join", d.email, 3, 900)) return { ok: false, error: LIMITED };
    const row = await upsertMember(o.db, { name: d.name, email: d.email, affiliation: d.affiliation, blocks: [], notify: [], src: eventSource(d.slug) }, null);
    if (row.inserted) await recordCheckin(o.db, o.e.id, row.id, "qr");
    else if (emailConfigured()) after(() => sendCheckinLink(o.db, d.email, o.e).catch((e) => console.error("check-in link failed", e instanceof Error ? e.message : e)));
    // Never the block number here: it would differ between new and existing emails.
    return { ok: true, n: null, viaJoin: true };
  } catch (e) {
    console.error("check-in join failed", e instanceof Error ? e.message : e);
    return { ok: false, error: GENERIC };
  }
}

/** The emailed one-tap link's page posts here (a click, so mail scanners can't use it up). */
export async function confirmCheckin(fd: FormData) {
  const slug = String(fd.get("slug") ?? "");
  const o = await openEvent(slug);
  const subject = o ? await consumeLinkToken(o.db, "checkin", String(fd.get("t") ?? "")) : null;
  const [memberId, eventId] = (subject ?? "").split(":").map(Number);
  if (!o || !memberId || eventId !== o.e.id) redirect(`/events/${encodeURIComponent(slug)}/checkin?error=link`);
  await recordCheckin(o.db, o.e.id, memberId, "qr");
  // Signed in for the day, like "Update your block", so the page shows them as checked in.
  const session = await createSession(o.db, "member", String(memberId), MEMBER_SESSION_MS);
  if (session) (await cookies()).set(MEMBER_COOKIE, session, cookieOptions(MEMBER_SESSION_MS));
  redirect(`/events/${slug}/checkin`);
}
