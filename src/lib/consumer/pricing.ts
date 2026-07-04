/**
 * Consumer C2 — effective-dated tier pricing resolution (pure, no side effects).
 *
 * Retail price is the base `StockItem.saleRate` (single source of truth, RULE-2).
 * A ConsumerPrice row is only a TIER OVERRIDE (member / wholesale / promo),
 * effective-dated: for a sale on `date`, the applicable tier price is the row for
 * that item+tier with the latest `effectiveFrom` on/before `date`. When no tier
 * row applies (or tier is 'retail'), it falls back to the base saleRate — so a
 * member never pays more than retail just because a member price wasn't set.
 */

export interface ConsumerPriceRow {
  itemId: string;
  tier: string;
  price: number;
  effectiveFrom: string;
  isDeleted?: boolean;
}

/**
 * Resolve the unit price for an item at a given tier on a given date.
 * `tier === 'retail'` (or empty) → base saleRate. Otherwise the effective tier
 * override, or saleRate if none is in force.
 */
export function resolveItemPrice(
  item: { id: string; saleRate: number },
  tier: string,
  prices: ReadonlyArray<ConsumerPriceRow>,
  date: string,
): number {
  const base = item.saleRate || 0;
  if (!tier || tier === 'retail') return base;
  const eligible = prices
    .filter(p => !p.isDeleted && p.itemId === item.id && p.tier === tier && (!p.effectiveFrom || p.effectiveFrom <= date))
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : a.effectiveFrom > b.effectiveFrom ? -1 : 0));
  const top = eligible[0];
  return top && typeof top.price === 'number' && isFinite(top.price) ? top.price : base;
}
