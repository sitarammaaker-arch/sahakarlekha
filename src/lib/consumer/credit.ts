/**
 * Consumer C3 — member store-credit outstanding & ageing (pure, no side effects).
 *
 * A member's outstanding is DERIVED, never stored: Σ(their credit-sale grand totals) −
 * Σ(their recovery receipts). Ageing applies recoveries FIFO against the oldest unpaid
 * credit sales, then buckets each sale's unpaid remainder by its age. This mirrors the
 * Dairy derived-outstanding model (no per-member sub-ledger, no denormalised balance).
 */

export interface CreditSaleRow {
  id: string;
  memberId?: string;
  paymentMode: string;
  grandTotal: number;
  netAmount: number;
  date: string;
}

export interface RecoveryRow {
  memberId?: string;
  amount: number;
  isDeleted?: boolean;
}

const saleTotal = (s: CreditSaleRow): number =>
  typeof s.grandTotal === 'number' && s.grandTotal > 0 ? s.grandTotal : (s.netAmount || 0);

/** A member's credit sales (paymentMode 'credit'), oldest first. */
export function memberCreditSales(sales: ReadonlyArray<CreditSaleRow>, memberId: string): CreditSaleRow[] {
  return sales
    .filter(s => s.memberId === memberId && s.paymentMode === 'credit')
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Total recovered for a member (excludes soft-deleted recovery vouchers). */
export function memberRecovered(recoveries: ReadonlyArray<RecoveryRow>, memberId: string): number {
  return recoveries
    .filter(r => r.memberId === memberId && !r.isDeleted)
    .reduce((sum, r) => sum + (r.amount || 0), 0);
}

export interface ReturnRow { memberId?: string; grandTotal?: number; refundMode?: string; isDeleted?: boolean; }

/** Credit-adjusted sales returns for a member (these reduce the receivable, like a recovery). */
export function memberReturnAdjusted(returns: ReadonlyArray<ReturnRow>, memberId: string): number {
  return returns
    .filter(r => r.memberId === memberId && r.refundMode === 'credit-adjust' && !r.isDeleted)
    .reduce((sum, r) => sum + (r.grandTotal || 0), 0);
}

/** Outstanding = Σ credit sales − Σ recoveries − Σ credit-adjusted returns, clamped ≥ 0. */
export function memberOutstanding(
  sales: ReadonlyArray<CreditSaleRow>,
  recoveries: ReadonlyArray<RecoveryRow>,
  memberId: string,
  returns: ReadonlyArray<ReturnRow> = [],
): number {
  const billed = memberCreditSales(sales, memberId).reduce((s, x) => s + saleTotal(x), 0);
  return Math.max(0, billed - memberRecovered(recoveries, memberId) - memberReturnAdjusted(returns, memberId));
}

export interface Ageing { b0_30: number; b31_60: number; b61_90: number; b90plus: number; total: number; }

/** Days between two ISO dates (asOf − date), floored at 0. */
function daysBetween(fromDate: string, asOf: string): number {
  const a = Date.parse(fromDate), b = Date.parse(asOf);
  if (!isFinite(a) || !isFinite(b)) return 0;
  return Math.max(0, Math.floor((b - a) / 86400000));
}

/**
 * FIFO ageing: apply total recoveries against oldest credit sales first, then bucket each
 * sale's unpaid remainder by its age at `asOf`.
 */
export function memberAgeing(
  sales: ReadonlyArray<CreditSaleRow>,
  recoveries: ReadonlyArray<RecoveryRow>,
  memberId: string,
  asOf: string,
  returns: ReadonlyArray<ReturnRow> = [],
): Ageing {
  const out: Ageing = { b0_30: 0, b31_60: 0, b61_90: 0, b90plus: 0, total: 0 };
  // Credit-adjusted returns reduce the receivable exactly like a recovery (FIFO against oldest).
  let recovered = memberRecovered(recoveries, memberId) + memberReturnAdjusted(returns, memberId);
  for (const s of memberCreditSales(sales, memberId)) {
    let unpaid = saleTotal(s);
    if (recovered > 0) {
      const applied = Math.min(recovered, unpaid);
      unpaid -= applied;
      recovered -= applied;
    }
    if (unpaid <= 0) continue;
    const age = daysBetween(s.date, asOf);
    if (age <= 30) out.b0_30 += unpaid;
    else if (age <= 60) out.b31_60 += unpaid;
    else if (age <= 90) out.b61_90 += unpaid;
    else out.b90plus += unpaid;
    out.total += unpaid;
  }
  return out;
}
