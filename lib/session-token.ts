import { createHmac, timingSafeEqual } from "node:crypto";

// Signed session cookies for admins and members, keyed by AUTH_SECRET. The signed subject is a
// random session id (lib/sessions.ts holds who it is and whether it's revoked). No "server-only"
// here: proxy.ts verifies the admin cookie's signature too. Without AUTH_SECRET nothing signs or
// verifies, so email sign-in is simply off (the shared-password fallback still works for /admin).

export const ADMIN_COOKIE = "nyubs_admin";
export const MEMBER_COOKIE = "nyubs_member";
export const ADMIN_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const MEMBER_SESSION_MS = 24 * 60 * 60 * 1000;

type Kind = "admin" | "member";
const key = () => process.env.AUTH_SECRET ?? "";
const mac = (kind: Kind, subject: string, exp: number) => createHmac("sha256", key()).update(`${kind}|${subject}|${exp}`).digest("base64url");

/** `<subject>.<expiry>.<signature>`, or null when AUTH_SECRET isn't set. */
export function signSession(kind: Kind, subject: string, ttlMs: number): string | null {
  if (!key()) return null;
  const exp = Date.now() + ttlMs;
  return `${Buffer.from(subject).toString("base64url")}.${exp}.${mac(kind, subject, exp)}`;
}

export function readSession(kind: Kind, value: string | undefined | null): { subject: string; exp: number } | null {
  if (!value || !key()) return null;
  const [s, e, sig] = value.split(".");
  const exp = Number(e);
  if (!s || !sig || !Number.isFinite(exp) || exp < Date.now()) return null;
  const subject = Buffer.from(s, "base64url").toString();
  const want = Buffer.from(mac(kind, subject, exp)), got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? { subject, exp } : null;
}

export const cookieOptions = (maxAgeMs: number) => ({
  httpOnly: true,
  secure: Boolean(process.env.VERCEL),
  sameSite: "lax" as const,
  path: "/",
  maxAge: Math.floor(maxAgeMs / 1000),
});
