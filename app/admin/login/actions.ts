"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { audit, roleFor } from "@/lib/admin";
import { baseUrl } from "@/lib/base-url";
import { getDb, type Db } from "@/lib/db";
import { emailConfigured, renderEmail, sendEmail } from "@/lib/email";
import { consumeLinkToken, createLinkToken } from "@/lib/magic-link";
import { rateLimited, rateLimitedEmail } from "@/lib/security";
import { ADMIN_COOKIE, ADMIN_SESSION_MS, cookieOptions } from "@/lib/session-token";
import { createSession, revokeSession } from "@/lib/sessions";

import { reportError } from "@/lib/monitoring";
export type LinkState = { sent: boolean; error?: string } | null;

/** The same answer, at the same speed, whether or not the email is an admin. */
const SENT: LinkState = { sent: true };
const LIMITED: LinkState = { sent: false, error: "Too many attempts. Please try again in a few minutes." };

export async function requestAdminLink(_prev: LinkState, fd: FormData): Promise<LinkState> {
  const email = z.email().max(254).safeParse(String(fd.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { sent: false, error: "Enter a valid email address." };
  const db = getDb();
  if (!db || !process.env.AUTH_SECRET || !emailConfigured()) {
    return { sent: false, error: "Email sign-in isn't set up for this environment." };
  }
  // Per IP and per email, counted before anything depends on whether the email is an admin.
  if (await rateLimited(db, "admin-link", 5, 600)) return LIMITED;
  if (await rateLimitedEmail(db, "admin-link", email.data, 3, 900)) return LIMITED;
  // The lookup and the send happen after the response, so its timing can't tell admins apart.
  after(() => sendAdminLink(db, email.data).catch((e) => reportError("admin", "admin link failed", e)));
  return SENT;
}

async function sendAdminLink(db: Db, email: string) {
  if (!(await roleFor(db, email))) return;
  const token = await createLinkToken(db, "admin", email);
  // A fixed origin from the environment (lib/base-url.ts), never the request's Host header.
  const href = `${baseUrl()}/admin/login/verify?t=${token}`;
  const r = await sendEmail(db, "admin-link", {
    to: email,
    subject: "Your NYU Blockchain Society admin sign-in link",
    ...renderEmail({
      kicker: "Admin",
      heading: "Sign in to the admin",
      paragraphs: ["Use this button to sign in. It works once and expires in 15 minutes."],
      cta: { label: "Sign in", href },
      note: "If you didn't ask for this, ignore this email: nobody can sign in without the link.",
    }),
  });
  if (!r.ok) console.error("admin link not sent:", r.error);
}

/** The link's page posts here (a click, not the page load, so mail scanners can't use the link up). */
export async function signInWithLink(fd: FormData) {
  const db = getDb();
  const email = db ? await consumeLinkToken(db, "admin", String(fd.get("t") ?? "")) : null;
  const role = email ? await roleFor(db, email) : null;
  const session = db && email && role ? await createSession(db, "admin", email, ADMIN_SESSION_MS) : null;
  if (!db || !email || !session) redirect("/admin/login?error=link");
  (await cookies()).set(ADMIN_COOKIE, session, cookieOptions(ADMIN_SESSION_MS));
  await audit(db, email, "admin.sign-in", "Signed in with an email link").catch(() => {});
  redirect("/admin");
}

/** Ends the session on the server too: a copy of the cookie stops working as well. */
export async function signOut() {
  const jar = await cookies();
  const db = getDb();
  if (db) await revokeSession(db, "admin", jar.get(ADMIN_COOKIE)?.value).catch(() => {});
  jar.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
