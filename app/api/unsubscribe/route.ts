import { getDb } from "@/lib/db";
import { applyUnsubscribe, unsubscribeTarget } from "@/lib/unsubscribe";

/**
 * RFC 8058 one-click unsubscribe: mail apps POST here from the List-Unsubscribe header, for
 * member emails and contact invites alike. Only POST unsubscribes; a GET (a person or a link
 * scanner) goes to the page with its button.
 */
export async function POST(request: Request) {
  const target = unsubscribeTarget(new URL(request.url).searchParams.get("t") ?? "");
  const db = getDb();
  if (!target || !db) return new Response("Invalid link.", { status: 400 });
  await applyUnsubscribe(db, target, true);
  return new Response("Unsubscribed.", { status: 200 });
}

export function GET(request: Request) {
  const t = new URL(request.url).searchParams.get("t") ?? "";
  return Response.redirect(new URL(`/unsubscribe?t=${encodeURIComponent(t)}`, request.url), 303);
}
