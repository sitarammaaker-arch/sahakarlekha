/**
 * RPT-18 (audit 2026-11-17) — NPA age bands as on the REPORT's date, not the day the page is opened.
 *
 * The NABARD and Federation returns aged every loan against `new Date()`: the same FY's return changed class
 * depending on when it was opened (a loan due 01-12-2025 is 120 days overdue on 31-03-2026 — Sub-Standard — but 369
 * days on 05-12-2026 — Doubtful). Both now age against reportAsOf(FY): the FY's last day, or today while the FY is
 * still running. A loan with no due date is not counted as overdue (it used to fall into "Loss" through NaN). PURE.
 */
export type NpaClass = 'Standard' | 'Sub-Standard' | 'Doubtful' | 'Loss';

/** The as-on date of an FY return ("2025-26" → 31-03-2026), or today if that is earlier; local midnight. */
export function reportAsOf(financialYear: string, now: Date = new Date()): Date {
  const endYear = Number(`20${String(financialYear || '').split('-')[1] ?? ''}`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!Number.isFinite(endYear) || endYear < 2000) return today;
  const fyEnd = new Date(endYear, 2, 31);
  return fyEnd < today ? fyEnd : today;
}

/** Whole days a due date is past `asOf` (0 when not yet due or when the due date is missing / invalid). */
export function overdueDaysAt(dueDate: string | undefined, asOf: Date): number {
  if (!dueDate) return 0;
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return 0;
  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.max(0, Math.round((asOf.getTime() - due.getTime()) / 86400000));
}

/** The NABARD-style band for a number of overdue days (≤90 Standard, ≤365 Sub-Standard, ≤1095 Doubtful, else Loss). */
export function npaClassForDays(days: number): NpaClass {
  if (days <= 90) return 'Standard';
  if (days <= 365) return 'Sub-Standard';
  if (days <= 1095) return 'Doubtful';
  return 'Loss';
}
