import { adminForRoute, audit, describeFilters } from "@/lib/admin";
import { listContacts, parseContactFilters } from "@/lib/contacts-query";
import { csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  // All CSV exports: super admins only, and every one is logged.
  const auth = await adminForRoute("super_admin");
  if (auth instanceof Response) return auth;
  const { db, actor } = auth;
  const filters = parseContactFilters(Object.fromEntries(new URL(request.url).searchParams));
  const rows = await listContacts(db, filters);
  await audit(db, actor, "export.contacts", `Exported ${rows.length} contacts (filters: ${describeFilters(filters)})`);
  const cols = ["id", "name", "email", "headline", "source", "checkedIn", "memberId", "linkMethod", "invitedAt", "importedAt"] as const;
  return csvResponse("contacts", cols, rows.map(({ c }) => c));
}
