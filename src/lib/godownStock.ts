/**
 * Godown-wise stock (ECR-17 Phase 3).
 *
 * Computes on-hand quantity and value per (item × godown) from stock movements,
 * using the canonical stock formula (RULE 2): purchases and positive adjustments
 * add; sales and negative adjustments subtract. Value is at the weighted-average
 * INWARD cost. Movements with no godown fall into an "unassigned" bucket, so the
 * report is complete even before every entry is godown-tagged. Pure & tested by
 * scripts/test-godown-stock.mjs.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

export const UNASSIGNED_GODOWN = 'unassigned';

export interface GodownMovement {
  itemId: string;
  type: string;          // 'purchase' | 'sale' | 'adjustment' | 'opening' | …
  qty: number;
  rate?: number;
  godownId?: string;
  date?: string;
  isDeleted?: boolean;
}

export interface GodownStockRow {
  itemId: string;
  godownId: string;
  qty: number;
  value: number;
}

/** Signed quantity change for a movement (RULE 2). */
export function qtyDelta(type: string, qty: number): number {
  if (type === 'purchase' || type === 'opening' || (type === 'adjustment' && qty > 0)) return qty;
  return -Math.abs(qty);
}

/**
 * Batch C (RULE 2): the movements every per-godown view reads — the item OPENING stock (as an
 * 'opening' inward into the unassigned bucket, at the item's purchase rate) followed by the
 * movements ALREADY reconciled against live purchase/sale records (reconcileMovements). Before, the
 * godown views read raw movements and never added opening stock, so godown totals did not match the
 * Inventory / Trading A/c closing stock and opening stock could never be transferred ("0 available").
 * The 'opening' rows are for the godown views only — never feed them to computeStock (which treats
 * any non-purchase type as outward).
 */
export function godownMovementsWithOpening<M extends GodownMovement>(
  items: ReadonlyArray<{ id: string; openingStock?: number; purchaseRate?: number }>,
  reconciled: ReadonlyArray<M>,
): Array<GodownMovement & { referenceNo?: string }> {
  const openings = items
    .filter(i => (i.openingStock || 0) > 0)
    .map(i => ({ itemId: i.id, type: 'opening', qty: i.openingStock || 0, rate: i.purchaseRate || 0, godownId: UNASSIGNED_GODOWN, date: '', referenceNo: 'OPENING' }));
  return [...openings, ...reconciled];
}

/** On-hand stock per (item, godown): net qty (floored at 0) + value at weighted-avg inward cost. */
export function computeGodownStock(movements: GodownMovement[], asOf?: string): GodownStockRow[] {
  const map = new Map<string, { itemId: string; godownId: string; qty: number; inQty: number; inValue: number }>();
  for (const m of movements) {
    if (m.isDeleted) continue;
    if (asOf && m.date && m.date > asOf) continue;
    const godownId = m.godownId || UNASSIGNED_GODOWN;
    const key = `${m.itemId}::${godownId}`;
    const row = map.get(key) ?? { itemId: m.itemId, godownId, qty: 0, inQty: 0, inValue: 0 };
    const delta = qtyDelta(m.type, m.qty || 0);
    row.qty += delta;
    if (delta > 0) { row.inQty += delta; row.inValue += delta * (m.rate || 0); }
    map.set(key, row);
  }
  const rows: GodownStockRow[] = [];
  for (const r of map.values()) {
    const qty = r2(Math.max(0, r.qty));
    const avg = r.inQty > 0 ? r.inValue / r.inQty : 0;
    if (qty > 0.0001) rows.push({ itemId: r.itemId, godownId: r.godownId, qty, value: r2(qty * avg) });
  }
  return rows;
}

/** Roll godown-stock rows up to a per-godown total value. */
export function godownTotals(rows: GodownStockRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.godownId] = r2((out[r.godownId] || 0) + r.value);
  return out;
}
