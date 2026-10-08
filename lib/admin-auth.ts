// HTTP basic auth for /admin. Used by proxy.ts and re-checked inside admin actions and
// routes, because server actions can be invoked from any path.

const enc = new TextEncoder();

/** Constant-time string compare that works in both the proxy and Node runtimes. */
function same(a: string, b: string) {
  const x = enc.encode(a), y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function isAdminAuthorized(authorization: string | null): boolean {
  const user = process.env.ADMIN_USER, pass = process.env.ADMIN_PASS;
  if (!user || !pass || !authorization?.startsWith("Basic ")) return false;
  let decoded = "";
  try { decoded = atob(authorization.slice(6)); } catch { return false; }
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  return same(decoded.slice(0, i), user) && same(decoded.slice(i + 1), pass);
}

export const ADMIN_CHALLENGE = { status: 401, headers: { "WWW-Authenticate": 'Basic realm="NYU Blockchain Society admin", charset="UTF-8"', "X-Robots-Tag": "noindex, nofollow" } };
