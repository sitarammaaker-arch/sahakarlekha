/**
 * Storage-loss vs norm (ECR-20 warehouse). Cooperative godowns lose some stock in storage
 * (driage, spillage, spoilage) — auditors allow this only up to a permitted NORM %. This
 * compares each item's actual storage loss against the society's norm so excess loss is visible.
 *
 * Definitions (per item, over the movements supplied):
 *   • inwardQty — quantity received: purchases, opening, and positive adjustments.
 *   • lossQty   — storage loss: the magnitude of NEGATIVE adjustments. Sales are a legitimate
 *                 issue (type 'sale'), not loss, so they are excluded. Inter-godown transfer legs
 *                 (referenceNo 'TRF/…') are relocations, not loss, so they are excluded too.
 *   • actualLossPct = lossQty ÷ inwardQty × 100.
 * Deleted movements (RULE-5) are excluded.
 *
 * Pure module: no React, no I/O — unit-tested by scripts/test-storage-loss.mjs.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface StorageLossMovement {
  itemId: string;
  type: string;          // 'purchase' | 'sale' | 'adjustment' | 'opening' | …
  qty: number;
  referenceNo?: string;
  isDeleted?: boolean;
}

export interface StorageLossRow {
  itemId: string;
  inwardQty: number;
  lossQty: number;
  actualLossPct: number;
  normPct: number;
  excessPct: number;   // max(0, actual − norm)
  withinNorm: boolean;
}

const isTransfer = (ref?: string) => (ref || '').startsWith('TRF/');

/** Per-item storage loss vs the society norm. Rows are returned for items that had inward stock. */
export function computeStorageLoss(movements: readonly StorageLossMovement[], normPct: number): StorageLossRow[] {
  const norm = normPct > 0 ? normPct : 0;
  const map = new Map<string, { inwardQty: number; lossQty: number }>();
  for (const m of movements || []) {
    if (m.isDeleted) continue;
    if (isTransfer(m.referenceNo)) continue;            // relocation, not loss/inward
    const qty = m.qty || 0;
    const row = map.get(m.itemId) ?? { inwardQty: 0, lossQty: 0 };
    if (m.type === 'purchase' || m.type === 'opening' || (m.type === 'adjustment' && qty > 0)) {
      row.inwardQty += qty;
    } else if (m.type === 'adjustment' && qty < 0) {
      row.lossQty += Math.abs(qty);                     // negative adjustment = storage loss
    }
    // 'sale' and other types contribute to neither.
    map.set(m.itemId, row);
  }
  const rows: StorageLossRow[] = [];
  for (const [itemId, r] of map.entries()) {
    if (r.inwardQty <= 0) continue;                     // no throughput → no meaningful loss %
    const actualLossPct = r2((r.lossQty / r.inwardQty) * 100);
    rows.push({
      itemId,
      inwardQty: r2(r.inwardQty),
      lossQty: r2(r.lossQty),
      actualLossPct,
      normPct: norm,
      excessPct: r2(Math.max(0, actualLossPct - norm)),
      withinNorm: actualLossPct <= norm,
    });
  }
  return rows;
}
