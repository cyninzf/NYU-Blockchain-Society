import { NextResponse, type NextRequest } from "next/server";
import { pastEditions } from "@/content/conferences";
import { ADMIN_COOKIE, readSession } from "@/lib/session-token";

const YEARS = new Set(pastEditions.map((e) => String(e.year)));

const admin = (res: NextResponse) => {
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Unknown conference years: a real 404 status (the streamed page would otherwise answer 200).
  const year = /^\/conference\/([^/]+)\/?$/.exec(pathname)?.[1];
  if (year !== undefined) {
    return YEARS.has(year) ? NextResponse.next() : NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }

  // Sign-in pages are open (they never show admin data).
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) return admin(NextResponse.next());

  // Only keeps strangers out (a signed magic-link session cookie): pages, actions and routes
  // re-check the session is live and the admin's role.
  if (readSession("admin", request.cookies.get(ADMIN_COOKIE)?.value)) return admin(NextResponse.next());
  if (request.method === "GET") return admin(NextResponse.redirect(new URL("/admin/login", request.url)));
  return new NextResponse("Authentication required.", { status: 401, headers: { "X-Robots-Tag": "noindex, nofollow" } });
}

export const config = { matcher: ["/admin", "/admin/:path*", "/conference/:year"] };
