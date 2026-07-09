/**
 * Deleted-stock-movement archival (ECR-21 / RULE-3). When a stock item, sale, or purchase
 * is removed, its stock movements are hard-deleted from the live table (so the canonical
 * stock formula stays correct — nothing lingers to double-count). To retain the history for
 * audit without touching that formula, the deleted movements are snapshotted here and written
 * to the append-only audit log BEFORE the hard delete. PURE → unit-tested by
 * scripts/test-movement-archive.mjs.
 */
import type { StockMovement } from '@/types';

export interface DeletedMovementSnapshot {
  id: string;
  itemId: string;
  type: string;
  qty: number;
  referenceNo?: string;
  date: string;
}

/** Compact, non-PII snapshot of the movements about to be deleted (for the audit trail). */
export function snapshotDeletedMovements(
  movements: ReadonlyArray<Pick<StockMovement, 'id' | 'itemId' | 'type' | 'qty' | 'referenceNo' | 'date'>>,
): DeletedMovementSnapshot[] {
  return (movements || []).map((m) => ({
    id: m.id,
    itemId: m.itemId,
    type: m.type,
    qty: m.qty,
    referenceNo: m.referenceNo,
    date: m.date,
  }));
}
