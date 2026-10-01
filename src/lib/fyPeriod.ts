/**
 * Indian financial-year periods (1 April – 31 March) for multi-year books (Phase-2 C, decision D1:
 * one continuous ledger). A report "as of" a date shows the balance brought forward at the START of
 * that date's financial year as its opening column, and only that year's vouchers as transactions.
 * Pure; unit-tested by scripts/test-fy-period.mjs.
 */

/** 1 April of the financial year that contains `date` ('YYYY-MM-DD…'). */
export function fyStartOf(date: string): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  return `${m >= 4 ? y : y - 1}-04-01`;
}

/** 1 April of a financial-year label 'YYYY-YY' (undefined for anything else). */
export function fyStartFromLabel(label?: string | null): string | undefined {
  const m = /^(\d{4})-\d{2}$/.exec(label || '');
  return m ? `${m[1]}-04-01` : undefined;
}

/** A gross brought-forward (Dr and Cr sums, minor units) shown as ONE net opening figure. */
export function netOpening(drMinor: number, crMinor: number): { drMinor: number; crMinor: number } {
  const n = drMinor - crMinor;
  return n >= 0 ? { drMinor: n, crMinor: 0 } : { drMinor: 0, crMinor: -n };
}
