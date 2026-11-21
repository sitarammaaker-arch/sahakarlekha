/**
 * PERF-01 (product audit 2026-11-17): the voucher list filtered, sorted and rendered EVERY voucher on every render —
 * thousands of table rows, each looking its accounts up in the whole chart. These pure helpers let the page search
 * once (memoised) and render one page at a time.
 */
export const VOUCHER_PAGE_SIZE = 50;

export interface ListableVoucher {
  id: string;
  voucherNo?: string;
  date?: string;
  narration?: string;
  amount?: number;
  type?: string;
  createdAt?: string;
}

/** Case-insensitive match on voucher no., narration, type, date, amount and the voucher's account names. */
export function matchesVoucherQuery(v: ListableVoucher, query: string, accountNames: readonly string[] = []): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const amount = v.amount != null ? String(v.amount) : '';
  const hay = [v.voucherNo, v.narration, v.type, v.date, amount, ...accountNames].filter(Boolean).join(' ').toLowerCase();
  // Every word must appear somewhere ("rent 5000" finds the rent voucher of 5000).
  return q.split(/\s+/).every((w) => hay.includes(w) || (/^[\d.,]+$/.test(w) && amount.includes(w.replace(/,/g, ''))));
}

export interface PageSlice<T> { rows: T[]; page: number; pages: number; from: number; to: number; total: number }

/** One page of `list` (1-based). A page past the end clamps to the last page, so a shrinking list never shows blank. */
export function pageOf<T>(list: readonly T[], page: number, size = VOUCHER_PAGE_SIZE): PageSlice<T> {
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const start = (p - 1) * size;
  const rows = list.slice(start, start + size);
  return { rows, page: p, pages, from: total ? start + 1 : 0, to: start + rows.length, total };
}
