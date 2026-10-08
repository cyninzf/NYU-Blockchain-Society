import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_CHALLENGE, isAdminAuthorized } from "@/lib/admin-auth";

export function proxy(request: NextRequest) {
  if (!isAdminAuthorized(request.headers.get("authorization"))) {
    return new NextResponse("Authentication required.", ADMIN_CHALLENGE);
  }
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
