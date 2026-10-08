import { isAdminAuthorized, ADMIN_CHALLENGE } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { listMembers, parseFilters } from "@/lib/members-query";

// Neutralise spreadsheet formulas and quote every cell.
const cell = (v: unknown) => {
  let s = v == null ? "" : v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join(";") : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(request: Request) {
  if (!isAdminAuthorized(request.headers.get("authorization"))) return new Response("Authentication required.", ADMIN_CHALLENGE);
  const db = getDb();
  if (!db) return new Response("DATABASE_URL is not set for this environment.", { status: 503 });
  const rows = await listMembers(db, parseFilters(Object.fromEntries(new URL(request.url).searchParams)));
  const cols = ["id", "name", "email", "affiliation", "blocks", "notify", "source", "linkedinUrl", "role", "company", "school", "gradYear", "showOnWall", "wallName", "wallApproved", "createdAt", "updatedAt"] as const;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="members-${date}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
