/**
 * PURE — was this bank voucher cleared AS OF the reconciliation date? (audit A-07)
 *
 * The BRS used the live `isCleared` flag only, so backdating the "as on" date to a month
 * where a cheque was still outstanding still showed it as cleared today. A voucher counts as
 * cleared on `asOfDate` only if it is flagged cleared AND its clearing date is on or before
 * that date. A cleared voucher with no recorded clearing date is treated as cleared (legacy).
 * Dependency-free so scripts/test-bank-clearing.mjs can import it directly.
 */
export function isClearedAsOf(
  v: { isCleared?: boolean; clearedDate?: string },
  asOfDate: string,
): boolean {
  if (!v.isCleared) return false;
  if (!v.clearedDate) return true;
  return v.clearedDate <= asOfDate;
}
