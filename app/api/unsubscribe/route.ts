import { getDb } from "@/lib/db";
import { memberFromUnsubscribeToken, setUnsubscribed } from "@/lib/member-email";

/**
 * RFC 8058 one-click unsubscribe: mail apps POST here from the List-Unsubscribe header. Only
 * POST unsubscribes; a GET (a person or a link scanner) goes to the page with its button.
 */
export async function POST(request: Request) {
  const id = memberFromUnsubscribeToken(new URL(request.url).searchParams.get("t") ?? "");
  const db = getDb();
  if (!id || !db) return new Response("Invalid link.", { status: 400 });
  await setUnsubscribed(db, id, true);
  return new Response("Unsubscribed.", { status: 200 });
}

export function GET(request: Request) {
  const t = new URL(request.url).searchParams.get("t") ?? "";
  return Response.redirect(new URL(`/unsubscribe?t=${encodeURIComponent(t)}`, request.url), 303);
}
