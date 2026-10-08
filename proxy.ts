import { NextResponse, type NextRequest } from "next/server";
import { pastEditions } from "@/content/conferences";
import { ADMIN_CHALLENGE, isAdminAuthorized } from "@/lib/admin-auth";

const YEARS = new Set(pastEditions.map((e) => String(e.year)));

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Unknown conference years: a real 404 status (the streamed page would otherwise answer 200).
  const year = /^\/conference\/([^/]+)\/?$/.exec(pathname)?.[1];
  if (year !== undefined) {
    return YEARS.has(year) ? NextResponse.next() : NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }

  if (!isAdminAuthorized(request.headers.get("authorization"))) {
    return new NextResponse("Authentication required.", ADMIN_CHALLENGE);
  }
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = { matcher: ["/admin", "/admin/:path*", "/conference/:year"] };
