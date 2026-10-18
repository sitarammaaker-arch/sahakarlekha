/** Stage D: PURE paging for long registers (the component lives in components/ListPager). */
export const DEFAULT_PAGE_SIZE = 50;

/** The rows of page `page` (0-based), clamped to the last page; from/to are 1-based for display. */
export function pageSlice<T>(rows: readonly T[], page: number, size = DEFAULT_PAGE_SIZE): { rows: T[]; page: number; pages: number; from: number; to: number } {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(0, page), pages - 1);
  const from = p * size;
  return { rows: rows.slice(from, from + size), page: p, pages, from: rows.length ? from + 1 : 0, to: Math.min(rows.length, from + size) };
}
