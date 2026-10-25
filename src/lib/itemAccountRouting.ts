/**
 * Per-item ledger routing for stock documents (RULE 4) — PURE, no React, no Supabase.
 *
 * Marketing audit 2026-10-25, batch C:
 *  - The item form's Purchase A/c dropdown listed every leaf under 5100, including 5150
 *    "Closing Stock (Trading A/c)". A purchase routed there vanished from both the Trading A/c and
 *    the P&L (5150 is the closing-stock contra, excluded from both), so cost silently disappeared.
 *  - A sale/purchase line whose item is not in the stock list had no routing at all and fell to
 *    '4101' / '5101' — in the marketing chart 4101 is "Fertilizer Sales".
 * Tested by scripts/test-item-account-routing.mjs.
 */

export const CLOSING_STOCK_CONTRA_ID = '5150';

/** May a stock item route its sales / purchases to this ledger? Never a group, never the closing-stock contra. */
export function isRoutableItemAccount(a: { id: string; isGroup?: boolean; subtype?: string }): boolean {
  return !a.isGroup && a.id !== CLOSING_STOCK_CONTRA_ID && a.subtype !== 'closing_stock';
}

/** Lines whose itemId is not a known stock item (empty itemId included). */
export function unknownItemLines<L extends { itemId: string; itemName?: string }>(
  lines: ReadonlyArray<L>,
  stockItems: ReadonlyArray<{ id: string }>,
): L[] {
  const known = new Set(stockItems.map(s => s.id));
  return lines.filter(l => !known.has(l.itemId));
}

export function UNKNOWN_ITEM_MESSAGE(kind: 'sale' | 'purchase', lines: ReadonlyArray<{ itemId: string; itemName?: string }>): string {
  const names = lines.map(l => l.itemName || l.itemId || '—').join(', ');
  return kind === 'sale'
    ? `ये वस्तुएँ स्टॉक सूची में नहीं हैं: ${names} — इनका बिक्री खाता तय नहीं हो सकता। पहले Inventory में वस्तु बनाएँ (या पंक्ति हटाएँ), फिर बिक्री पोस्ट करें। (Items not in stock list: ${names})`
    : `ये वस्तुएँ स्टॉक सूची में नहीं हैं: ${names} — इनका खरीद खाता तय नहीं हो सकता। पहले Inventory में वस्तु बनाएँ (या पंक्ति हटाएँ), फिर खरीद पोस्ट करें। (Items not in stock list: ${names})`;
}
