import { adminForRoute, audit, describeFilters } from "@/lib/admin";
import { csvResponse } from "@/lib/csv";
import { listMembers, parseFilters } from "@/lib/members-query";

export async function GET(request: Request) {
  // All CSV exports: super admins only, and every one is logged.
  const auth = await adminForRoute("super_admin");
  if (auth instanceof Response) return auth;
  const { db, actor } = auth;
  const filters = parseFilters(Object.fromEntries(new URL(request.url).searchParams));
  const rows = await listMembers(db, filters);
  await audit(db, actor, "export.members", `Exported ${rows.length} members (filters: ${describeFilters(filters)})`);
  const cols = ["id", "name", "email", "affiliation", "blocks", "notify", "source", "linkedinUrl", "role", "company", "school", "gradYear", "location", "country", "createdAt", "updatedAt"] as const;
  return csvResponse("members", cols, rows);
}
