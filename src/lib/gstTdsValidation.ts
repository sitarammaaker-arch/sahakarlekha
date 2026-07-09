/**
 * Voucher-level GST / TDS validation (ECR-22 slice C).
 *
 * Pure checks over the GST/TDS fields of sales, purchases and vouchers — catches
 * the common data-entry errors that make returns wrong: a supply booked as BOTH
 * intra- and inter-state, CGST ≠ SGST, tax that doesn't match rate × taxable, an
 * off-slab rate, a malformed GSTIN, or a TDS-liable payment with no TDS deducted.
 * Read-only advisory (never blocks a save). Unit-tested by
 * scripts/test-gst-tds-validation.mjs.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

export type Severity = 'error' | 'warn';
export interface GstIssue { ref: string; field: string; message: string; severity: Severity; }

export interface GstCheckRecord {
  ref?: string;
  netAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cgstPct?: number;
  sgstPct?: number;
  igstPct?: number;
  gstin?: string;
  isDeleted?: boolean;
}

// Standard + special GST slabs (incl. 0.25/1/3 for bullion, 6/7.5 composition-ish).
const VALID_RATES = new Set([0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28]);
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Structural GSTIN check: 2-digit state + 10-char PAN + entity/Z/checksum. */
export function validateGSTIN(gstin?: string): boolean {
  return !!gstin && GSTIN_RE.test(gstin.trim().toUpperCase());
}

/** Effective rate of a record (IGST inter-state, else CGST+SGST). */
function rateOf(rec: GstCheckRecord): number {
  const igst = rec.igstAmount || 0;
  return igst > 0 ? (rec.igstPct || 0) : r2((rec.cgstPct || 0) + (rec.sgstPct || 0));
}

/** Validate one GST record; returns 0..n issues. */
export function validateGstRecord(rec: GstCheckRecord): GstIssue[] {
  const issues: GstIssue[] = [];
  const ref = rec.ref || '?';
  const taxable = rec.netAmount || 0;
  const cgst = rec.cgstAmount || 0, sgst = rec.sgstAmount || 0, igst = rec.igstAmount || 0;

  if ((cgst > 0 || sgst > 0) && igst > 0)
    issues.push({ ref, field: 'gst', severity: 'error', message: 'Both CGST/SGST and IGST present — a supply is either intra-state or inter-state, not both' });

  if (igst === 0 && Math.abs(cgst - sgst) > 0.5)
    issues.push({ ref, field: 'gst', severity: 'error', message: `CGST (${cgst}) ≠ SGST (${sgst}) — intra-state tax must split equally` });

  const rate = rateOf(rec);
  if (rate > 0 && taxable > 0) {
    const expected = r2((taxable * rate) / 100);
    const actual = r2(cgst + sgst + igst);
    if (Math.abs(expected - actual) > 1)
      issues.push({ ref, field: 'gst', severity: 'warn', message: `Tax ${actual} ≠ taxable ${taxable} × ${rate}% (expected ${expected})` });
  }
  if (rate > 0 && !VALID_RATES.has(rate))
    issues.push({ ref, field: 'rate', severity: 'warn', message: `Unusual GST rate ${rate}% — verify (standard 0/5/12/18/28)` });

  if (rec.gstin && !validateGSTIN(rec.gstin))
    issues.push({ ref, field: 'gstin', severity: 'error', message: `Invalid GSTIN format: ${rec.gstin}` });

  return issues;
}

export interface TdsCheckRecord { ref?: string; amount: number; tdsAmount?: number; threshold?: number; isDeleted?: boolean; }

/** Flag a payment above the TDS threshold with no TDS deducted. */
export function validateTds(rec: TdsCheckRecord): GstIssue[] {
  const ref = rec.ref || '?';
  const amount = rec.amount || 0;
  const threshold = rec.threshold ?? 0;
  if (threshold > 0 && amount > threshold && (rec.tdsAmount || 0) <= 0)
    return [{ ref, field: 'tds', severity: 'warn', message: `Amount ${amount} exceeds TDS threshold ${threshold} but no TDS was deducted` }];
  return [];
}

/** Validate a batch of GST records (skips deleted). */
export function validateGstBatch(records: GstCheckRecord[]): GstIssue[] {
  return records.filter(r => !r.isDeleted).flatMap(validateGstRecord);
}
