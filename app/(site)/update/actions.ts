"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { NOTIFY } from "@/content/notify";
import { INDUSTRY_IDS } from "@/content/industries";
import { baseUrl } from "@/lib/base-url";
import { countIsPublic } from "@/lib/chain-stats";
import { getDb, type Db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { emailConfigured, renderEmail, sendEmail } from "@/lib/email";
import { countryOf } from "@/lib/location";
import { consumeLinkToken, createLinkToken } from "@/lib/magic-link";
import { unsubscribeHeaders, unsubscribeUrl } from "@/lib/member-email";
import { gradYear, linkedinUrl, location, optText } from "@/lib/member-fields";
import { rateLimited, rateLimitedEmail } from "@/lib/security";
import { memberIdFromSession } from "@/lib/member-session";
import { cookieOptions, MEMBER_COOKIE, MEMBER_SESSION_MS } from "@/lib/session-token";
import { createSession, revokeSession } from "@/lib/sessions";

export type LinkState = { sent: true } | { sent: false; error: string } | null;

/** The same answer, at the same speed, whether or not the email is a member. */
const SENT: LinkState = { sent: true };
const LIMITED: LinkState = { sent: false, error: "Too many attempts. Please try again in a few minutes." };

export async function requestMemberLink(_prev: LinkState, fd: FormData): Promise<LinkState> {
  const email = z.email().max(254).safeParse(String(fd.get("email") ?? "").trim());
  if (!email.success) return { sent: false, error: "Enter the email you joined with, like name@example.com." };
  const db = getDb();
  if (!db || !process.env.AUTH_SECRET || !emailConfigured()) return { sent: false, error: "This isn't available right now. Please try again later." };
  // Per IP and per email, counted before anything depends on whether the email is a member.
  if (await rateLimited(db, "member-link", 5, 600)) return LIMITED;
  if (await rateLimitedEmail(db, "member-link", email.data, 3, 900)) return LIMITED;
  // The lookup and the send happen after the response, so its timing can't tell members apart.
  after(() => sendMemberLink(db, email.data).catch((e) => console.error("member link failed", e instanceof Error ? e.message : e)));
  return SENT;
}

async function sendMemberLink(db: Db, email: string) {
  // Unsubscribed members get no email of any kind, this one included.
  const [m] = await db.select({ id: members.id, email: members.email }).from(members)
    .where(and(eq(sql`lower(${members.email})`, email.toLowerCase()), isNull(members.unsubscribedAt)));
  if (!m) return;
  const token = await createLinkToken(db, "member", String(m.id));
  const r = await sendEmail(db, "member-link", {
    to: m.email,
    subject: "Update your block",
    ...renderEmail({
      kicker: (await countIsPublic(db)) ? `Block #${m.id}` : "Your block",
      heading: "Update your block",
      paragraphs: ["Use this button to change your blocks, details and email preferences. It works once and expires in 15 minutes."],
      // A fixed origin from the environment (lib/base-url.ts), never the request's Host header.
      cta: { label: "Update your block", href: `${baseUrl()}/update/verify?t=${token}` },
      note: "If you didn't ask for this, ignore this email: nothing changes without the link.",
      unsubscribeUrl: unsubscribeUrl(m.id),
    }),
    headers: unsubscribeHeaders(m.id),
  });
  if (!r.ok) console.error("member link not sent:", r.error);
}

/** The link's page posts here (a click, so mail scanners can't use the link up). */
export async function openWithLink(fd: FormData) {
  const db = getDb();
  const id = db ? await consumeLinkToken(db, "member", String(fd.get("t") ?? "")) : null;
  const session = db && id ? await createSession(db, "member", id, MEMBER_SESSION_MS) : null;
  if (!session) redirect("/update?error=link");
  (await cookies()).set(MEMBER_COOKIE, session, cookieOptions(MEMBER_SESSION_MS));
  redirect("/update/edit");
}

/** Ends the session on the server too. */
export async function signOutMember() {
  const jar = await cookies();
  const db = getDb();
  if (db) await revokeSession(db, "member", jar.get(MEMBER_COOKIE)?.value).catch(() => {});
  jar.delete(MEMBER_COOKIE);
  redirect("/update");
}

const BlockInput = z.object({
  blocks: z.array(z.enum(INDUSTRY_IDS)).max(3),
  notify: z.array(z.enum(NOTIFY)).max(NOTIFY.length),
  linkedinUrl,
  role: optText(120),
  company: optText(120),
  school: optText(120),
  gradYear,
  location,
});

export type SaveState = { ok: true } | { ok: false; error: string } | null;

/** A member edits their own block: blocks, optional details and notify preferences. Never name or email. */
export async function saveOwnBlock(_prev: SaveState, fd: FormData): Promise<SaveState> {
  const id = await memberIdFromSession();
  if (!id) return { ok: false, error: "Your link has expired. Ask for a new one to keep editing." };
  const parsed = BlockInput.safeParse({ ...Object.fromEntries(fd), blocks: fd.getAll("blocks").map(String), notify: fd.getAll("notify").map(String) });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const d = parsed.data;
  const db = getDb();
  if (!db) return { ok: false, error: "Something went wrong on our side. Please try again in a moment." };
  const [m] = await db.select({ notify: members.notify }).from(members).where(eq(members.id, id));
  if (!m) return { ok: false, error: "We couldn't find your block. It may have been removed." };
  // Stored values the form doesn't offer (e.g. an old "mentorship" notify) are kept.
  const notify = [...m.notify.filter((n) => !(NOTIFY as string[]).includes(n)), ...NOTIFY.filter((n) => d.notify.includes(n))];
  await db.update(members).set({
    blocks: INDUSTRY_IDS.filter((b) => d.blocks.includes(b)), notify,
    linkedinUrl: d.linkedinUrl, role: d.role, company: d.company, school: d.school, gradYear: d.gradYear,
    location: d.location, country: countryOf(d.location), updatedAt: new Date(),
  }).where(eq(members.id, id));
  revalidateTag("chain", "max");
  return { ok: true };
}
