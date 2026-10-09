import { ADMIN_CHALLENGE, isAdminAuthorized } from "@/lib/admin-auth";
import { csvResponse } from "@/lib/csv";
import { getDb } from "@/lib/db";
import { listMembers, parseFilters } from "@/lib/members-query";

export async function GET(request: Request) {
  if (!isAdminAuthorized(request.headers.get("authorization"))) return new Response("Authentication required.", ADMIN_CHALLENGE);
  const db = getDb();
  if (!db) return new Response("DATABASE_URL is not set for this environment.", { status: 503 });
  const rows = await listMembers(db, parseFilters(Object.fromEntries(new URL(request.url).searchParams)));
  const cols = ["id", "name", "email", "affiliation", "blocks", "notify", "source", "linkedinUrl", "role", "company", "school", "gradYear", "location", "country", "showOnWall", "wallName", "wallApproved", "createdAt", "updatedAt"] as const;
  return csvResponse("members", cols, rows);
}
