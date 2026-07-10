/**
 * Godown capacity utilisation (ECR-20 warehouse). Surfaces the godown's rated capacity
 * (capacityMT — already on the Godown master) against how much is currently stored, so an
 * over-filled or under-used godown is visible. Read-only, derived — changes no stock.
 *
 * The "used" quantity is passed in (the caller sums on-hand qty for the godown from the tested
 * computeGodownStock rows), keeping this a pure presentation calc with no formula of its own.
 *
 * Pure module: no React, no I/O — unit-tested by scripts/test-godown-capacity.mjs.
 */
export interface CapacityUtilisation {
  capacityMT: number | null;      // rated capacity (null when unset — nothing to compare against)
  usedQty: number;                // on-hand quantity in the godown
  utilisationPct: number | null;  // used ÷ capacity × 100 (null when capacity unset/0)
  overCapacity: boolean;          // usedQty exceeds capacity (only meaningful when capacity set)
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function capacityUtilisation(usedQty: number, capacityMT: number | undefined | null): CapacityUtilisation {
  const cap = capacityMT != null && capacityMT > 0 ? capacityMT : null;
  const used = usedQty || 0;
  return {
    capacityMT: cap,
    usedQty: used,
    utilisationPct: cap ? r1((used / cap) * 100) : null,
    overCapacity: cap != null && used > cap,
  };
}
