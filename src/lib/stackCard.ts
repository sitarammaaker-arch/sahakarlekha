/**
 * Stack card / bin card (ECR-20 warehouse). A chronological, per-(item × godown) running-balance
 * ledger — the classic warehouse register showing each inward/outward movement and the balance
 * after it. Read-only: derived purely from existing stock movements, it creates nothing and does
 * not touch how movements are recorded.
 *
 * RULE-2 consistency: the signed quantity change per movement is the SAME rule the on-hand report
 * uses — this reuses `qtyDelta` from godownStock.ts verbatim rather than re-deriving it. The
 * closing balance therefore ties to computeGodownStock's on-hand qty whenever stock never went
 * negative. Unlike the on-hand aggregate (which floors at 0), the ledger shows the TRUE running
 * balance so an over-issue (negative) is surfaced for audit instead of silently hidden.
 *
 * Deleted movements (RULE-5) are excluded. Pure module — unit-tested by scripts/test-stack-card.mjs.
 */
import { qtyDelta, UNASSIGNED_GODOWN, type GodownMovement } from './godownStock';

export interface StackCardEntry {
  date?: string;
  type: string;
  referenceNo?: string;
  inQty: number;   // quantity received (0 for an issue)
  outQty: number;  // quantity issued (0 for a receipt)
  balance: number; // running on-hand balance AFTER this movement (true signed running total)
}

type StackCardMovement = GodownMovement & { referenceNo?: string };

/**
 * Chronological running-balance ledger for one (itemId, godownId). Pass `UNASSIGNED_GODOWN`
 * for the godownId to see movements that were never godown-tagged.
 */
export function buildStackCard(
  movements: readonly StackCardMovement[],
  itemId: string,
  godownId: string,
): StackCardEntry[] {
  const rows = (movements || [])
    .filter(m => !m.isDeleted && m.itemId === itemId && (m.godownId || UNASSIGNED_GODOWN) === godownId)
    // stable chronological sort — undated movements keep their original relative order (sort last).
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      const da = a.m.date || '';
      const db = b.m.date || '';
      if (da !== db) return da < db ? -1 : 1;
      return a.i - b.i;
    });

  let balance = 0;
  return rows.map(({ m }) => {
    const delta = qtyDelta(m.type, m.qty || 0);
    balance += delta;
    return {
      date: m.date,
      type: m.type,
      referenceNo: m.referenceNo,
      inQty: delta > 0 ? delta : 0,
      outQty: delta < 0 ? -delta : 0,
      balance: Math.round(balance * 100) / 100,
    };
  });
}
