import { ADMIN_CHALLENGE, isAdminAuthorized } from "@/lib/admin-auth";
import { listContacts, parseContactFilters } from "@/lib/contacts-query";
import { csvResponse } from "@/lib/csv";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  if (!isAdminAuthorized(request.headers.get("authorization"))) return new Response("Authentication required.", ADMIN_CHALLENGE);
  const db = getDb();
  if (!db) return new Response("DATABASE_URL is not set for this environment.", { status: 503 });
  const rows = await listContacts(db, parseContactFilters(Object.fromEntries(new URL(request.url).searchParams)));
  const cols = ["id", "name", "email", "source", "checkedIn", "memberId", "invitedAt", "importedAt"] as const;
  return csvResponse("contacts", cols, rows);
}
