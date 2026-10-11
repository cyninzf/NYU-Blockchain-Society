// Admin tables (round 23): 100 rows per page, ?page=<n> (1-based) beside the current filters.

export const PAGE_SIZE = 100;

/** ?page=3 → 3; anything missing or invalid → 1. Clamped to the last page once the total is known (`pageWindow`). */
export function parsePage(sp: Record<string, string | string[] | undefined>): number {
  const n = typeof sp.page === "string" && /^\d{1,6}$/.test(sp.page) ? Number(sp.page) : 1;
  return Math.max(1, n);
}

/** The page actually shown (a page past the end shows the last one) and its offset. */
export function pageWindow(page: number, total: number) {
  const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const p = Math.min(page, last);
  return { page: p, last, offset: (p - 1) * PAGE_SIZE };
}
