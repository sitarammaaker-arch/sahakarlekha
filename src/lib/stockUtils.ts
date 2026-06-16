import type { StockItem, StockMovement } from '@/types';

/**
 * THE single canonical stock-quantity formula (CLAUDE.md RULE 2).
 *
 * Stock is ALWAYS derived from openingStock + movements — never read from the
 * stored `stockItem.currentStock` field, which is only a denormalised cache and
 * drifts whenever a purchase/sale voucher is edited or deleted (incremental
 * +/- updates lose information; `Math.max(0, …)` clamps hide it). Reading the
 * cache caused the "sale screen shows 120 but stock report shows 0" class of bug.
 *
 * Every surface that needs an available/closing quantity (Sale availability,
 * Inventory, Stock Valuation, Trading A/c, Balance Sheet) MUST use these helpers
 * so there is exactly ONE formula in the codebase.
 */

/** Movement-based quantity for a single item. */
export function computeStock(item: Pick<StockItem, 'id' | 'openingStock'>, movements: StockMovement[]): number {
  let qty = item.openingStock || 0;
  for (const m of movements) {
    if (m.itemId !== item.id) continue;
    if (m.type === 'purchase' || (m.type === 'adjustment' && m.qty > 0)) qty += m.qty;
    else qty -= Math.abs(m.qty);
  }
  return Math.max(0, qty);
}

/**
 * Movement-based quantity for every item, in a single O(items + movements) pass.
 * Returns a map of itemId -> quantity (clamped at 0).
 */
export function computeStockMap(items: StockItem[], movements: StockMovement[]): Record<string, number> {
  const acc = new Map<string, number>();
  for (const it of items) acc.set(it.id, it.openingStock || 0);
  for (const m of movements) {
    if (!acc.has(m.itemId)) continue;
    const delta = (m.type === 'purchase' || (m.type === 'adjustment' && m.qty > 0)) ? m.qty : -Math.abs(m.qty);
    acc.set(m.itemId, (acc.get(m.itemId) as number) + delta);
  }
  const map: Record<string, number> = {};
  for (const it of items) map[it.id] = Math.max(0, acc.get(it.id) as number);
  return map;
}
