import { listInterest, parseInterestFilters } from "@/lib/accelerator-interest";
import { adminForRoute, audit, describeFilters } from "@/lib/admin";
import { csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  // All CSV exports: super admins only, and every one is logged.
  const auth = await adminForRoute("super_admin");
  if (auth instanceof Response) return auth;
  const { db, actor } = auth;
  const filters = parseInterestFilters(Object.fromEntries(new URL(request.url).searchParams));
  const rows = await listInterest(db, filters);
  await audit(db, actor, "export.accelerator", `Exported ${rows.length} accelerator interest rows (filters: ${describeFilters(filters)})`);
  const cols = ["id", "type", "name", "email", "affiliation", "company", "oneLiner", "stage", "focus", "website", "organization", "help", "message", "addMember", "status", "createdAt"] as const;
  return csvResponse("accelerator-interest", cols, rows);
}
