import { adminForRoute, audit, describeFilters } from "@/lib/admin";
import { csvResponse } from "@/lib/csv";
import { listRoster, parseRosterFilters } from "@/lib/roster-query";

// The stored roster columns only. Field buckets are aggregate insights and never go per person.
export async function GET(request: Request) {
  // All CSV exports: super admins only, and every one is logged.
  const auth = await adminForRoute("super_admin");
  if (auth instanceof Response) return auth;
  const { db, actor } = auth;
  const filters = parseRosterFilters(Object.fromEntries(new URL(request.url).searchParams));
  const rows = await listRoster(db, filters);
  await audit(db, actor, "export.linkedin-group", `Exported ${rows.length} LinkedIn group rows (filters: ${describeFilters(filters)})`);
  const cols = ["id", "name", "headline", "groupRole", "source", "importedAt", "memberId"] as const;
  return csvResponse("linkedin-group", cols, rows.map(({ r }) => r));
}
