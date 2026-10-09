import { ADMIN_CHALLENGE, isAdminAuthorized } from "@/lib/admin-auth";
import { csvResponse } from "@/lib/csv";
import { getDb } from "@/lib/db";
import { listRoster, parseRosterFilters } from "@/lib/roster-query";

// The stored roster columns only. Field buckets are aggregate insights and never go per person.
export async function GET(request: Request) {
  if (!isAdminAuthorized(request.headers.get("authorization"))) return new Response("Authentication required.", ADMIN_CHALLENGE);
  const db = getDb();
  if (!db) return new Response("DATABASE_URL is not set for this environment.", { status: 503 });
  const rows = await listRoster(db, parseRosterFilters(Object.fromEntries(new URL(request.url).searchParams)));
  const cols = ["id", "name", "headline", "groupRole", "source", "importedAt", "memberId"] as const;
  return csvResponse("linkedin-group", cols, rows.map(({ r }) => r));
}
