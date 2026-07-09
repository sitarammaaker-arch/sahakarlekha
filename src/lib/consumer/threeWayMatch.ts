/**
 * Procurement 3-way match (ECR-21 Phase 1) — pure, tested.
 *
 * Compares the three procurement documents for one Purchase Order:
 *   1. PO      — what was ORDERED   (item.qty, item.rate)
 *   2. GRN     — what was RECEIVED  (item.receivedQty ?? qty, valued at PO rate)
 *   3. Invoice — what was BILLED    (the linked Purchase's item.qty × item.rate)
 *
 * and flags, per line and overall, whether the three agree within a tolerance band.
 * This catches (a) short/over deliveries (ordered ≠ received) and (b) an invoice that
 * has drifted from the receipt (received ≠ billed) — e.g. after a later edit.
 *
 * Read-only: no posting, no state. Mirrors scripts/test-threeway-match.mjs.
 */
import type { PurchaseOrderItem, PurchaseItem } from '@/types';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const EPS = 0.005; // treat sub-half-paisa / sub-milli-unit deltas as exact

export type MatchStatus = 'matched' | 'within-tolerance' | 'exception';

/** Why a line is not a clean match (empty when matched). */
export type MatchReason =
  | 'short-delivery'      // received < ordered
  | 'over-delivery'       // received > ordered
  | 'over-billed-qty'     // billed qty > received
  | 'under-billed-qty'    // billed qty < received
  | 'price-variance'      // billed rate ≠ PO rate
  | 'unbilled'            // received but no invoice line
  | 'extra-invoice-line'; // invoice line with no matching PO line

export interface MatchLine {
  itemId: string;
  itemName: string;
  unit: string;
  orderedQty: number;
  receivedQty: number;
  billedQty: number;
  poRate: number;
  billedRate: number;
  orderedAmount: number;   // ordered qty × PO rate
  receivedAmount: number;  // received qty × PO rate (GRN value)
  billedAmount: number;    // invoice line amount
  qtyVarOrderedReceived: number; // received − ordered (negative = short)
  qtyVarReceivedBilled: number;  // billed − received (positive = over-billed)
  priceVar: number;              // billed rate − PO rate
  amountVar: number;             // billed − received value
  status: MatchStatus;
  reasons: MatchReason[];
}

export interface MatchSummary {
  status: MatchStatus;          // worst line status
  lineCount: number;
  matched: number;
  withinTolerance: number;
  exceptions: number;
  orderedTotal: number;
  receivedTotal: number;
  billedTotal: number;
  amountVarianceTotal: number;  // billedTotal − receivedTotal
}

export interface ThreeWayMatchResult {
  lines: MatchLine[];
  summary: MatchSummary;
}

/** Tolerance band: a variance is acceptable if within `pct`% of the base OR within `abs`. */
export interface MatchTolerance {
  pct?: number;  // default 2 (%)
  abs?: number;  // default 1 (absolute floor, in the value's own unit)
}

const withinTol = (variance: number, base: number, tol: Required<MatchTolerance>): boolean => {
  const v = Math.abs(variance);
  if (v <= EPS) return true;
  return v <= Math.max(Math.abs(base) * (tol.pct / 100), tol.abs);
};

const isZero = (n: number): boolean => Math.abs(n) <= EPS;

/**
 * Match one PO against its (optional) invoice. `purchaseItems` are the billed lines
 * from the linked Purchase; pass an empty array when no invoice exists yet.
 */
export function threeWayMatch(
  poItems: ReadonlyArray<PurchaseOrderItem>,
  purchaseItems: ReadonlyArray<PurchaseItem>,
  tolerance: MatchTolerance = {},
): ThreeWayMatchResult {
  const tol: Required<MatchTolerance> = { pct: tolerance.pct ?? 2, abs: tolerance.abs ?? 1 };
  const billedByItem = new Map<string, PurchaseItem>();
  for (const b of purchaseItems) billedByItem.set(b.itemId, b);

  const lines: MatchLine[] = [];

  // 1. Every PO line, matched to its invoice line (if any).
  for (const p of poItems) {
    const orderedQty = p.qty || 0;
    const receivedQty = p.receivedQty ?? p.qty ?? 0;
    const poRate = p.rate || 0;
    const bill = billedByItem.get(p.itemId);
    billedByItem.delete(p.itemId); // consumed → leftovers are extra invoice lines
    const billedQty = bill?.qty || 0;
    const billedRate = bill?.rate || 0;
    const orderedAmount = round2(orderedQty * poRate);
    const receivedAmount = round2(receivedQty * poRate);
    const billedAmount = bill ? (bill.amount || round2(billedQty * billedRate)) : 0;

    const qtyVarOrderedReceived = round2(receivedQty - orderedQty);
    const qtyVarReceivedBilled = round2(billedQty - receivedQty);
    const priceVar = round2(billedRate - poRate);
    const amountVar = round2(billedAmount - receivedAmount);

    const reasons: MatchReason[] = [];
    if (qtyVarOrderedReceived < -EPS) reasons.push('short-delivery');
    if (qtyVarOrderedReceived > EPS) reasons.push('over-delivery');
    if (!bill) {
      if (receivedQty > EPS) reasons.push('unbilled');
    } else {
      if (qtyVarReceivedBilled > EPS) reasons.push('over-billed-qty');
      if (qtyVarReceivedBilled < -EPS) reasons.push('under-billed-qty');
      if (!isZero(priceVar)) reasons.push('price-variance');
    }

    // Status. The hard gate (payment risk) is RECEIVED-vs-BILLED — qty, price, amount —
    // plus a received-but-unbilled line: any of these beyond tolerance ⇒ 'exception'.
    // A delivery-only variance (ordered ≠ received but billed correctly) is a visible
    // flag, not a payment block, so it caps at 'within-tolerance'.
    let status: MatchStatus;
    let paymentClean: boolean, paymentWithinTol: boolean;
    if (!bill) {
      paymentClean = receivedQty <= EPS;
      paymentWithinTol = paymentClean;
    } else {
      paymentClean = isZero(qtyVarReceivedBilled) && isZero(priceVar) && isZero(amountVar);
      paymentWithinTol = withinTol(qtyVarReceivedBilled, receivedQty, tol)
        && withinTol(priceVar, poRate, tol)
        && withinTol(amountVar, receivedAmount, tol);
    }
    const deliveryClean = isZero(qtyVarOrderedReceived);
    if (!bill && receivedQty > EPS) status = 'exception';        // received goods, no invoice
    else if (!paymentWithinTol) status = 'exception';            // over-billed / price / amount beyond tol
    else if (paymentClean && deliveryClean) status = 'matched';  // all three agree
    else status = 'within-tolerance';                            // minor drift or delivery-only variance

    lines.push({
      itemId: p.itemId, itemName: p.itemName, unit: p.unit,
      orderedQty, receivedQty, billedQty, poRate, billedRate,
      orderedAmount, receivedAmount, billedAmount,
      qtyVarOrderedReceived, qtyVarReceivedBilled, priceVar, amountVar,
      status, reasons,
    });
  }

  // 2. Invoice lines with no matching PO line → extra-invoice-line exceptions.
  for (const bill of billedByItem.values()) {
    const billedQty = bill.qty || 0;
    const billedRate = bill.rate || 0;
    const billedAmount = bill.amount || round2(billedQty * billedRate);
    lines.push({
      itemId: bill.itemId, itemName: bill.itemName, unit: bill.unit,
      orderedQty: 0, receivedQty: 0, billedQty, poRate: 0, billedRate,
      orderedAmount: 0, receivedAmount: 0, billedAmount,
      qtyVarOrderedReceived: 0, qtyVarReceivedBilled: round2(billedQty), priceVar: 0,
      amountVar: round2(billedAmount),
      status: 'exception', reasons: ['extra-invoice-line'],
    });
  }

  const matched = lines.filter(l => l.status === 'matched').length;
  const withinToleranceCount = lines.filter(l => l.status === 'within-tolerance').length;
  const exceptions = lines.filter(l => l.status === 'exception').length;
  const orderedTotal = round2(lines.reduce((s, l) => s + l.orderedAmount, 0));
  const receivedTotal = round2(lines.reduce((s, l) => s + l.receivedAmount, 0));
  const billedTotal = round2(lines.reduce((s, l) => s + l.billedAmount, 0));

  const summary: MatchSummary = {
    status: exceptions > 0 ? 'exception' : withinToleranceCount > 0 ? 'within-tolerance' : 'matched',
    lineCount: lines.length,
    matched, withinTolerance: withinToleranceCount, exceptions,
    orderedTotal, receivedTotal, billedTotal,
    amountVarianceTotal: round2(billedTotal - receivedTotal),
  };

  return { lines, summary };
}

/**
 * ECR-21 Phase 3 — does this match carry a payment-risk exception that should HOLD
 * the goods receipt until a variance approval? True when any line is an exception
 * (over-billed qty / price / amount beyond tolerance, unbilled receipt, or an extra
 * invoice line). Delivery-only variances (within-tolerance) do NOT block.
 */
export function hasBlockingVariance(result: ThreeWayMatchResult): boolean {
  return result.summary.exceptions > 0;
}

/** Short, human-readable list of the distinct exception reasons (for an approval prompt). */
export function blockingReasons(result: ThreeWayMatchResult): MatchReason[] {
  const seen = new Set<MatchReason>();
  for (const l of result.lines) if (l.status === 'exception') for (const r of l.reasons) seen.add(r);
  return [...seen];
}
