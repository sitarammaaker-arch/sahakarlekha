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

/**
 * THE start date ('YYYY-04-01') of a society's current financial year — every screen and check that
 * needs "FY start" reads it from here, never from society.financialYearStart directly.
 * That column has held two meanings: Register wrote an ISO date, but Society Setup's old "वर्ष प्रारंभ"
 * select wrote the WORD 'april' (8 of 32 prod societies on 2026-10-20), and a string compare such as
 * '2026-05-01' < 'april' then broke every date check on those societies. The FY label 'YYYY-YY' is the
 * source of truth (migration 073 derives FY rows from it too); an ISO financialYearStart is only the
 * fallback when the label is missing or malformed. A non-ISO value is ignored (undefined).
 */
export function societyFyStart(
  society?: { financialYear?: string | null; financialYearStart?: string | null } | null,
): string | undefined {
  const fromLabel = fyStartFromLabel(society?.financialYear);
  if (fromLabel) return fromLabel;
  const raw = society?.financialYearStart || '';
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

/** A gross brought-forward (Dr and Cr sums, minor units) shown as ONE net opening figure. */
export function netOpening(drMinor: number, crMinor: number): { drMinor: number; crMinor: number } {
  const n = drMinor - crMinor;
  return n >= 0 ? { drMinor: n, crMinor: 0 } : { drMinor: 0, crMinor: -n };
}
