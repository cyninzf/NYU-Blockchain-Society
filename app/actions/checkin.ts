"use server";

// Event check-in at /networking/<slug>/checkin. Three ways in, none of which reveals whether an
// email belongs to a member:
// - a member session (from "Update your block" or an earlier check-in link): one button;
// - an email: if it's a member's, they get a one-tap check-in link (same rules as /update), and
//   everyone sees the same answer plus a short join form;
// - the join form: a new email joins and is checked in at once; an existing email is never
//   checked in unverified (it gets the one-tap link instead), with the same answer on screen.
// Test mode (round 12.1, `test`): super admins only (refused with a 403 and logged otherwise),
// on any event and at any time; check-ins are stored as tests, and the join form creates nothing
// unless the admin ticks "Create a real member".

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireSuperOr403 } from "@/lib/admin";
import { countIsPublic } from "@/lib/chain-stats";
import { checkinEvent, recordCheckin, sendCheckinLink, type CheckinEvent } from "@/lib/checkin";
import { getDb, type Db } from "@/lib/db";
import { AFFILIATIONS } from "@/lib/db/schema";
import { emailConfigured } from "@/lib/email";
import { eventPath, eventSource } from "@/lib/event-fields";
import { consumeLinkToken } from "@/lib/magic-link";
import { upsertMember } from "@/lib/member-join";
import { memberIdFromSession } from "@/lib/member-session";
import { zodFieldErrors, type FieldErrors } from "@/lib/form-errors";
import { EXPIRED, formGuard, type GuardResult } from "@/lib/form-guard";
import { savePendingJoin } from "@/lib/pending-joins";
import { rateLimited, rateLimitedEmail, verify } from "@/lib/security";
import { cookieOptions, MEMBER_COOKIE, MEMBER_SESSION_MS } from "@/lib/session-token";
import { createSession } from "@/lib/sessions";

import { reportError } from "@/lib/monitoring";
import { trackServer } from "@/lib/analytics-server";
export type CheckinResult = { ok: true; n: number | null; viaJoin?: boolean; fake?: boolean } | { ok: false; error: string; fieldErrors?: FieldErrors };
export type EmailStep = { ok: true } | { ok: false; error: string; fieldErrors?: FieldErrors };

const GENERIC = "Something went wrong on our side. Please try again in a moment.";
const LIMITED = "Too many attempts. Please try again in a few minutes.";
const CLOSED = "Check-in isn't open for this event right now.";
const SLUG = /^[a-z0-9-]{1,40}$/;

/** The event if check-in may happen now: published and open, or, in test mode, any event for a super admin. */
async function openEvent(slug: string, test: boolean): Promise<{ db: Db; e: CheckinEvent } | null> {
  if (test) await requireSuperOr403(`use check-in test mode for ${slug}`);
  const db = getDb();
  if (!db || !SLUG.test(slug)) return null;
  const e = await checkinEvent(db, slug, test);
  return e && (test || e.window === "open") ? { db, e } : null;
}

/** A member with a session checks themselves in with one button. */
export async function checkInSelf(slug: string, test = false): Promise<CheckinResult> {
  const id = await memberIdFromSession();
  if (!id) return { ok: false, error: "Your sign-in has expired. Enter your email below instead." };
  const o = await openEvent(slug, test);
  if (!o) return { ok: false, error: CLOSED };
  try {
    if ((await recordCheckin(o.db, o.e.id, id, "qr", "system", test)) && !test) await trackServer("checkin_completed", { event: slug });
    return { ok: true, n: (await countIsPublic(o.db)) ? id : null };
  } catch (e) {
    reportError("checkin", "check-in failed", e);
    return { ok: false, error: GENERIC };
  }
}

const Email = z.email("Enter your email, like name@example.com.").trim().max(254);

/** Step 1 without a session: the same answer for any valid email; members get a one-tap link. */
export async function requestCheckin(slug: string, email: string, test = false): Promise<EmailStep> {
  const parsed = Email.safeParse(email);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your email.", fieldErrors: { email: parsed.error.issues[0]?.message ?? "Check your email." } };
  const o = await openEvent(slug, test);
  if (!o) return { ok: false, error: CLOSED };
  // Per IP and per email, counted before anything depends on whether the email is a member.
  if (await rateLimited(o.db, "checkin", 10, 600)) return { ok: false, error: LIMITED };
  if (await rateLimitedEmail(o.db, "checkin", parsed.data, 3, 900)) return { ok: false, error: LIMITED };
  // The lookup and the send happen after the response, so its timing can't tell members apart.
  if (emailConfigured()) after(() => sendCheckinLink(o.db, parsed.data, o.e, test).catch((e) => reportError("checkin", "check-in link failed", e)));
  return { ok: true };
}

const JoinInput = z.object({
  slug: z.string().regex(SLUG),
  formToken: z.string().max(200),
  name: z.string().trim().min(1, "Add your name.").max(120),
  email: Email,
  affiliation: z.enum(AFFILIATIONS).exclude(["friend"]),
  test: z.boolean().optional(),
  /** Test mode only: really create the member (default: nothing is created). */
  createReal: z.boolean().optional(),
});

/**
 * Step 2: the short join form. A new email joins (source event-<slug>) and is checked in at once.
 * An existing email isn't checked in without proof: it gets the one-tap link instead. The answer
 * on screen is the same either way. In test mode nothing is created unless `createReal`.
 */
export async function checkinJoin(input: z.input<typeof JoinInput>): Promise<CheckinResult> {
  const parsed = JoinInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again.", fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;
  const test = Boolean(d.test);
  // Test mode skips the bot checks so super admins can test quickly.
  const guard: GuardResult = test ? (verify(d.formToken) ? { kind: "ok", spam: null } : { kind: "expired" }) : formGuard("checkin", d.formToken);
  if (guard.kind === "expired") return { ok: false, error: EXPIRED };
  const o = await openEvent(d.slug, test);
  if (!o) return { ok: false, error: CLOSED };
  // Test mode, by default: the form is checked and nothing at all is created.
  if (test && !d.createReal) return { ok: true, n: null, viaJoin: true, fake: true };
  try {
    if (await rateLimited(o.db, "checkin-join", 8, 600)) return { ok: false, error: LIMITED };
    if (await rateLimitedEmail(o.db, "checkin-join", d.email, 3, 900)) return { ok: false, error: LIMITED };
    // A suspected bot is neither a member nor checked in: it waits in pending_joins (with the
    // event) for a super admin, and sees the same answer as everyone.
    if (guard.spam) {
      await savePendingJoin(o.db, { kind: "checkin", name: d.name, email: d.email, affiliation: d.affiliation, blocks: [], notify: [], source: eventSource(d.slug), eventId: o.e.id, spamReason: guard.spam });
      return { ok: true, n: null, viaJoin: true };
    }
    const row = await upsertMember(o.db, { name: d.name, email: d.email, affiliation: d.affiliation, blocks: [], notify: [], src: eventSource(d.slug) }, null);
    if (row.inserted && (await recordCheckin(o.db, o.e.id, row.id, "qr", "system", test)) && !test) await trackServer("checkin_completed", { event: d.slug });
    else if (emailConfigured()) after(() => sendCheckinLink(o.db, d.email, o.e, test).catch((e) => reportError("checkin", "check-in link failed", e)));
    // Never the block number here: it would differ between new and existing emails.
    return { ok: true, n: null, viaJoin: true };
  } catch (e) {
    reportError("checkin", "check-in join failed", e);
    return { ok: false, error: GENERIC };
  }
}

/**
 * The emailed one-tap link's page posts here (a click, so mail scanners can't use it up). A test
 * link (made in test mode by a super admin) records a test check-in, on any event, at any time.
 */
export async function confirmCheckin(fd: FormData) {
  const slug = String(fd.get("slug") ?? "");
  const db = getDb();
  const subject = db && SLUG.test(slug) ? await consumeLinkToken(db, "checkin", String(fd.get("t") ?? "")) : null;
  const [memberId, eventId, flag] = (subject ?? "").split(":");
  const test = flag === "t";
  const e = db && subject ? await checkinEvent(db, slug, test) : null;
  const back = `${eventPath(encodeURIComponent(slug))}/checkin${test ? "?test=1" : ""}`;
  if (!db || !e || Number(eventId) !== e.id || !Number(memberId) || (!test && e.window !== "open")) redirect(`${back}${test ? "&" : "?"}error=link`);
  if ((await recordCheckin(db, e.id, Number(memberId), "qr", "system", test)) && !test) await trackServer("checkin_completed", { event: slug });
  // Signed in for the day, like "Update your block", so the page shows them as checked in.
  const session = await createSession(db, "member", memberId, MEMBER_SESSION_MS);
  if (session) (await cookies()).set(MEMBER_COOKIE, session, cookieOptions(MEMBER_SESSION_MS));
  redirect(back);
}
