import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { pastEditions } from "@/content/conferences";
import { getDb } from "@/lib/db";
import { SLUG_RE } from "@/lib/event-fields";
import { ADMIN_COOKIE, readSession } from "@/lib/session-token";

const YEARS = new Set(pastEditions.map((e) => String(e.year)));

const admin = (res: NextResponse) => {
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
};

const noStore = (res: NextResponse) => {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
};

const notFound = (request: NextRequest) => NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });

/**
 * Whether /events/<slug> has a public page: published, or cancelled until it would have ended.
 * Never a draft. "published": check-in and the live screen, which cancelled events don't get.
 * "any": test mode (round 12.1), where drafts are allowed too (the pages check the role).
 */
async function eventIsPublic(slug: string, mode: "page" | "published" | "any" = "page") {
  const db = getDb();
  if (!db) return true; // local builds without a database: the page shows its own not-found
  try {
    const r = await db.execute(sql`select 1 from events where slug = ${slug} and (${mode === "any"} or status = 'published'
      or (${mode === "page"} and status = 'cancelled' and coalesce(ends_at, starts_at) > now())) limit 1`);
    return r.rows.length > 0;
  } catch {
    return true; // never turn a database hiccup into a 404 for a real event
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Unknown conference years: a real 404 status (the streamed page would otherwise answer 200).
  const year = /^\/conference\/([^/]+)\/?$/.exec(pathname)?.[1];
  if (year !== undefined) {
    return YEARS.has(year) ? NextResponse.next() : notFound(request);
  }

  // Events: drafts and unknown slugs get a real 404 status; the preview is for admins only.
  if (pathname === "/events/preview" || pathname === "/events/preview/") {
    return readSession("admin", request.cookies.get(ADMIN_COOKIE)?.value) ? admin(NextResponse.next()) : notFound(request);
  }
  const slug = /^\/events\/([^/]+)\/?$/.exec(pathname)?.[1];
  if (slug !== undefined) return SLUG_RE.test(slug) && (await eventIsPublic(slug)) ? NextResponse.next() : notFound(request);
  // Check-in (and its emailed link) and the live screen: published events only, except test mode
  // (?test=1) with a signed admin session (the page re-checks for a super admin), and a test
  // link's confirm page (?test=1 with its token; the token itself decides).
  const subMatch = /^\/events\/([^/]+)\/(checkin(?:\/confirm)?|live)\/?$/.exec(pathname);
  if (subMatch) {
    const [, sub, page] = subMatch;
    const q = request.nextUrl.searchParams;
    const testing = q.get("test") === "1" && (Boolean(readSession("admin", request.cookies.get(ADMIN_COOKIE)?.value)) || (page === "checkin/confirm" && Boolean(q.get("t"))));
    return SLUG_RE.test(sub) && (await eventIsPublic(sub, testing ? "any" : "published")) ? noStore(NextResponse.next()) : notFound(request);
  }
  // Everything else under an event (share images, calendar.ics) answers for itself.
  if (pathname.startsWith("/events/")) return NextResponse.next();

  // Sign-in pages are open (they never show admin data).
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) return admin(NextResponse.next());

  // Only keeps strangers out (a signed magic-link session cookie): pages, actions and routes
  // re-check the session is live and the admin's role.
  if (readSession("admin", request.cookies.get(ADMIN_COOKIE)?.value)) return admin(NextResponse.next());
  if (request.method === "GET") return admin(NextResponse.redirect(new URL("/admin/login", request.url)));
  return new NextResponse("Authentication required.", { status: 401, headers: { "X-Robots-Tag": "noindex, nofollow" } });
}

export const config = { matcher: ["/admin", "/admin/:path*", "/conference/:year", "/events/:slug", "/events/:slug/:path*"] };
