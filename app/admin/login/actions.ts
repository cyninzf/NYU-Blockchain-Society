"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, roleFor } from "@/lib/admin";
import { baseUrl } from "@/lib/base-url";
import { getDb } from "@/lib/db";
import { emailConfigured, renderEmail, sendEmail } from "@/lib/email";
import { consumeLinkToken, createLinkToken } from "@/lib/magic-link";
import { rateLimited } from "@/lib/security";
import { ADMIN_COOKIE, ADMIN_SESSION_MS, cookieOptions, signSession } from "@/lib/session-token";

export type LinkState = { sent: boolean; error?: string } | null;

/** The same answer whether or not the email is an admin, so it never reveals who is. */
const SENT: LinkState = { sent: true };

export async function requestAdminLink(_prev: LinkState, fd: FormData): Promise<LinkState> {
  const email = z.email().max(254).safeParse(String(fd.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { sent: false, error: "Enter a valid email address." };
  const db = getDb();
  if (!db || !process.env.AUTH_SECRET || !emailConfigured()) {
    return { sent: false, error: "Email sign-in isn't set up for this environment. Use the shared password below." };
  }
  if (await rateLimited(db, "admin-link", 5, 600)) return { sent: false, error: "Too many attempts. Please try again in a few minutes." };
  if (!(await roleFor(db, email.data))) return SENT;
  const token = await createLinkToken(db, "admin", email.data);
  const href = `${baseUrl()}/admin/login/verify?t=${token}`;
  const r = await sendEmail(db, "admin-link", {
    to: email.data,
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
  return SENT;
}

/** The link's page posts here (a click, not the page load, so mail scanners can't use the link up). */
export async function signInWithLink(fd: FormData) {
  const db = getDb();
  const email = db ? await consumeLinkToken(db, "admin", String(fd.get("t") ?? "")) : null;
  const role = email ? await roleFor(db, email) : null;
  const session = email && role ? signSession("admin", email, ADMIN_SESSION_MS) : null;
  if (!db || !email || !role || !session) redirect("/admin/login?error=link");
  (await cookies()).set(ADMIN_COOKIE, session, cookieOptions(ADMIN_SESSION_MS));
  await audit(db, email, "admin.sign-in", "Signed in with an email link").catch(() => {});
  redirect("/admin");
}

export async function signOut() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
